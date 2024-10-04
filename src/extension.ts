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
        let stop = false;

        let previousState: string;
        const reportProgress = async (state: string, isError = false) => {
            if (state !== previousState) {
                previousState = state;

                const show = isError ? vscode.window.showErrorMessage : vscode.window.showInformationMessage;
                const message = (buildId ? `Build ${buildId}: ` : 'Build ') + state;

                if (buildId) {
                    // REVISIT: modal
                    const res = await show(message, 'Show in browser');

                    if (res === 'Show in browser') {
                        const url = `${process.env.JENKINS_URL}/view/Playgrounds/job/CompletePlayground/${buildId}`;
                        vscode.env.openExternal(vscode.Uri.parse(url));
                    }
                } else {
                    show(message);
                }
            }
        };

        const check = async () => {
            fuckupMitigator++;

            if (fuckupMitigator >= 300) {
                vscode.window.showWarningMessage('Build progress indicator timed out');
                stop = true;
                return;
            }

            if (buildId) {
                try {
                    const status = await getBuildStatus(authHeader, buildId);
                    console.log('Build status: ', status);
                    if (status === 'ABORTED' || status === 'NOT_EXECUTED') {
                        reportProgress(status === 'ABORTED' ? 'cancelled' : 'failed', true);
                        stop = true;
                    } else if (status === 'SUCCESS') {
                        reportProgress('completed');
                        stop = true;
                    } else {
                        reportProgress('started');
                    }
                } catch (e) {
                    vscode.window.showErrorMessage('Failed to get build progress');
                    stop = true;
                }
            } else {
                try {
                    const id = await getBuildIdFromQueue(authHeader, queueId);
                    if (id) {
                        buildId = id;
                        reportProgress('started');
                    } else {
                        reportProgress('queued');
                    }
                } catch (e) {
                    vscode.window.showErrorMessage('Failed to get build progress');
                    stop = true;
                }
            }

            if (!stop) {
                timeoutId = setTimeout(() => check(), 2000);
            }
        };

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
