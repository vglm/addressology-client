interface BackendFetch {
    method?: string;
    body?: string;
    headers?: Headers;
}

const settings = {
    url: "/",
};

export function backendFetch(uri: string, params: BackendFetch): Promise<Response> {
    const headers = params.headers ?? new Headers();
    const method = params.method ?? "GET";
    const body = params.body;

    let url = uri;
    if (uri.startsWith("/")) {
        if (settings.url.endsWith("/")) {
            url = settings.url + uri.substring(1);
        } else {
            url = settings.url + uri;
        }
    } else {
        throw new Error("Uri must start with /");
    }

    if (body) {
        headers.append("Content-Type", "application/json");
    }
    console.log("Calling backend: " + url);

    return fetch(url, {
        method: method,
        headers: headers,
        body: body,
    });
}
