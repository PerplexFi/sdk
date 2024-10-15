export function gql(query: string): string {
    return query
        .replace(/(#.*)/g, '') // Remove comments (if any)
        .replace(/\s+/g, ' ') // Remove useless spaces/newlines
        .trim();
}

export async function queryGraphQL<Data, Variables = never>(
    apiUrl: string,
    query: string,
    variables?: Variables,
): Promise<Data> {
    const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
    });

    if (res.status !== 200) {
        let errorMessage: string;
        const body = await res.json();
        if (body && 'errors' in body) {
            errorMessage = body?.errors?.at?.(0)?.message;
        }
        errorMessage ??= 'Server error'; // Default to this string if API didn't provide a valid error.

        throw new Error(`Server returned HTTP code ${res.status}: ${errorMessage}`);
    }

    const { data } = await res.json();

    return data;
}
