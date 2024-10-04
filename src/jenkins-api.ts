import * as vscode from 'vscode';

export async function startBuild(authHeader: string, properties: Record<string, string>) {
    const params = new URLSearchParams(properties);
    const url = `${process.env.JENKINS_URL}/job/CompletePlayground/buildWithParameters?${params.toString()}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: authHeader }
    });

    if (res.ok) {
        const queueUrl = res.headers.get('Location') || '';
        const queueId = Number(
            queueUrl
                .split('/')
                .filter((part) => part.length > 0)
                .at(-1)
        );

        return queueId;
    } else {
        const err = await res.text();
        vscode.window.showErrorMessage(`Error starting build: Status ${res.status} - ${err}`);
    }
}

export async function getBuildIdFromQueue(authHeader: string, queueId: number) {
    const res = await fetch(`${process.env.JENKINS_URL}/queue/item/${queueId}/api/json`, {
        method: 'GET',
        headers: { Authorization: authHeader }
    });

    const body = (await res.json()) as any;
    return body.executable?.number;
}

export async function getBuildStatus(authHeader: string, id: number) {
    const res = await fetch(
        `${process.env.JENKINS_URL}/job/CompletePlayground/wfapi/runs?since=${id - 1}&fullStages=false`,
        {
            method: 'GET',
            headers: { Authorization: authHeader }
        }
    );

    const body = (await res.json()) as any[];
    return body[0].status as string;
}
