import * as vscode from 'vscode';
import * as dotenv from 'dotenv';
import * as path from 'path';

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

        const params = new URLSearchParams(state.properties);
        const url = `${process.env.JENKINS_URL}/job/CompletePlayground/buildWithParameters?${params.toString()}`;

        console.log(url);

        const authHeader = 'Basic ' + btoa(`${state.auth.username}:${state.auth.token}`);
        this.trackBuildProgress(123, authHeader);

        // const res = await fetch(url, {
        //     method: 'POST',
        //     headers: { Authorization: authHeader }
        // });
        //
        // if (res.ok) {
        //     const body = await res.text();
        //     const buildNumber = res.headers.get('location');
        //     vscode.window.showInformationMessage('Success: ' + buildNumber);
        // } else {
        //     const err = await res.text();
        //     vscode.window.showErrorMessage(`Error starting build: Status ${res.status} - ${err}`);
        // }
    }

    private trackBuildProgress(queueNumber: number | string, authHeader: string) {
        vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Playground build progress',
                cancellable: true
            },
            (progress, cancellationToken) => {
                let intervalId: NodeJS.Timeout;

                progress.report({ message: 'Build queued' });

                cancellationToken.onCancellationRequested(() => {
                    console.log('USER CANCELLED PROGRESS TRACKER');
                    clearInterval(intervalId);
                });

                return new Promise<void>((resolve) => {
                    let i = 0;
                    intervalId = setInterval(() => {
                        console.log('TODO: check progress');
                        i++;
                        if (i === 5) {
                            clearInterval(intervalId);
                            resolve();
                            // Show success message?
                        }

                        progress.report({ message: 'Building ' + i });
                    }, 2000);
                });
            }
        );

        // /queue/item/121354/api/json
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
