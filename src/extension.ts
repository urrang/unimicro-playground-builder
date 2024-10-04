import * as vscode from 'vscode';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { startBuild, getBuildIdFromQueue, getBuildStatus } from './jenkins-api';

export function activate(context: vscode.ExtensionContext) {
    dotenv.config({ path: path.join(__dirname, '..', '.env') });

    const disposables = [
        // Log hello world
        vscode.commands.registerCommand('vscode-playground-builder.helloWorld', () => {
            vscode.window.showInformationMessage('Hello World');
        }),

        // Register view provider
        vscode.window.registerWebviewViewProvider(
            ViewProvider.viewType,
            new ViewProvider(context.extensionUri, context)
        )
    ];

    context.subscriptions.push(...disposables);
}

export function deactivate() {}

class ViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'playgroundBuilder.panel';

    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _extensionContext: vscode.ExtensionContext
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage((message) => {
            if (message.command === 'save_state') {
                this._extensionContext.workspaceState.update('state', message.data);
            }

            if (message.command === 'get_state') {
                const state = this._extensionContext?.workspaceState.get('state');
                webviewView.webview.postMessage({ command: 'set_state', data: state });
            }

            if (message.command === 'log_info') {
                vscode.window.showInformationMessage(message.data);
            }

            if (message.command === 'log_error') {
                vscode.window.showErrorMessage(message.data);
            }

            if (message.command === 'start_build') {
                this.startBuild();
            }
        });
    }

    private async startBuild() {
        const state = this._extensionContext?.workspaceState.get('state') as any;

        if (!state.auth?.username || !state.auth?.token) {
            vscode.window.showErrorMessage('Unable to start build, missing jenkins authentication details');
        }

        const authHeader = 'Basic ' + btoa(`${state.auth.username}:${state.auth.token}`);

        const queueId = await startBuild(authHeader, state.properties);
        if (queueId) {
            this.trackProgress(queueId, authHeader);
        }
    }

    private async trackProgress(queueId: number, authHeader: string) {
        let buildId: number;
        let timeoutId: NodeJS.Timeout;
        let fuckupMitigator = 0;

        let previousState: string;
        const reportBuildProgress = async (state: string, isError = false) => {
            if (state !== previousState) {
                previousState = state;

                const show = isError ? vscode.window.showErrorMessage : vscode.window.showInformationMessage;

                show(`Build ${buildId} ${state}`, 'Show in browser').then((selectedAction) => {
                    if (selectedAction === 'Show in browser') {
                        const url = `${process.env.JENKINS_URL}/view/Playgrounds/job/CompletePlayground/${buildId}`;
                        vscode.env.openExternal(vscode.Uri.parse(url));
                    }
                });
            }
        };

        const check = async () => {
            fuckupMitigator++;

            if (fuckupMitigator >= 300) {
                vscode.window.showWarningMessage('Build progress indicator timed out');
                return;
            }

            if (!buildId) {
                try {
                    const id = await getBuildIdFromQueue(authHeader, queueId);
                    if (id) {
                        buildId = id;
                    }
                } catch (e) {
                    vscode.window.showErrorMessage('Failed to get build progress');
                    return;
                }
            }

            if (buildId) {
                try {
                    const status = await getBuildStatus(authHeader, buildId);
                    if (status === 'ABORTED' || status === 'FAILED') {
                        reportBuildProgress(status.toLowerCase(), true);
                        return;
                    } else if (status === 'SUCCESS') {
                        reportBuildProgress('completed');
                        return;
                    } else {
                        reportBuildProgress('started');
                    }
                } catch (e) {
                    vscode.window.showErrorMessage('Failed to get build progress');
                    return;
                }
            }

            timeoutId = setTimeout(() => check(), 2000);
        };

        vscode.window.showInformationMessage('Build queued');
        check();
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const getPath = (...parts: string[]) => vscode.Uri.joinPath(this._extensionUri, ...parts);
        const script = webview.asWebviewUri(getPath('webview', 'dist', 'index.js'));
        const styles = webview.asWebviewUri(getPath('webview', 'dist', 'index.css'));

        // Use a nonce to only allow a specific script to be run.
        const nonce = getNonce();

        return `
            <!DOCTYPE html>
			<html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">

                    <!-- Only allow styles from our extension directory, and scripts that have a specific nonce -->
                    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

                    <link href="${styles}" rel="stylesheet">
                    <title>Playground builder</title>
                </head>
                <body>
                    <div id="webview-container"></div>

                    <script nonce="${nonce}">
                        var extensionMode = 'build';
                    </script>

                    <script nonce="${nonce}" src="${script}"></script>
                </body>
			</html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
