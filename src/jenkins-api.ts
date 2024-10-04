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

export async function getQueueStatus(authHeader: string, queueId: number) {
    const res = await fetch(`${process.env.JENKINS_URL}/queue/item/${queueId}/api/json`, {
        method: 'GET',
        headers: { Authorization: authHeader }
    });

    if (res.ok) {
        const body = (await res.json()) as any;
        if (body.executable) {
            return { state: 'STARTED', id: Number(body.executable.number) };
        } else {
            return { state: 'QUEUED' };
        }
    } else {
        console.log(res.status);
        return { state: 'ERROR' };
    }
}

export async function getBuildStatus(authHeader: string, id: number) {
    const res = await fetch(
        `${process.env.JENKINS_URL}/job/CompletePlayground/wfapi/runs?since=${id - 1}&fullStages=true`,
        {
            method: 'GET',
            headers: { Authorization: authHeader }
        }
    );

    if (res.ok) {
        const runs = (await res.json()) as any;
        const job = runs[0];
        if (!job) {
            return { state: 'ERROR' };
        }

        if (job.status === 'ABORTED') {
            return { state: 'ABORTED' };
        }

        if (job.status === 'SUCCESS') {
            return { state: 'SUCCESS' };
        }

        // TODO: Error state?

        const stage = (job.stages as any[]).at(-1);
        return { state: job.status, stage: stage.name };
    } else {
        return { state: 'ERROR' };
    }
}
