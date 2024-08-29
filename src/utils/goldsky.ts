export async function queryGateway<Data, Variables>(query: string, variables: Variables): Promise<Data> {
    const res = await fetch('https://arweave-search.goldsky.com/graphql', {
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

        throw new Error(`Gateway returned HTTP code ${res.status}: ${errorMessage}`);
    }

    const { data } = await res.json();

    return data;
}

function gql(query: string): string {
    return query
        .replace(/(#.*)/g, '') // Remove comments (if any)
        .replace(/\s+/g, ' ') // Remove useless spaces/newlines
        .trim();
}

const TransactionFragment = gql(`
    fragment TransactionFragment on Transaction {
        id
        ingested_at
        owner {
            address
        }
        recipient
        tags {
            name
            value
        }
    }
`);

type GatewayTransaction = {
    id: string;
    ingested_at: number;
    owner: {
        address: string;
    };
    recipient: string;
    tags: Array<{
        name: string;
        value: string;
    }>;
};

export const GetTransactionsQuery = gql(`
    ${TransactionFragment}

    query transactions($tagsFilter: [TagFilter!]!, $min: Int!) {
        transactions(
            first: 100,
            sort: INGESTED_AT_ASC,
            ingested_at: { min: $min },
            tags: $tagsFilter
        ) {
            edges {
                node {
                    ...TransactionFragment
                }
            }
        }
    }
`);

export type GetTransactionsQueryVariables = {
    tagsFilter: Array<{ name: string; values: string[] }>;
    min: number;
};

export type GetTransactionsQueryData = {
    transactions: {
        edges: Array<{ node: GatewayTransaction }>;
    };
};

export const GetTransactionByIdQuery = gql(`
    query transactionById($id: ID!) {
        transaction(id: $id) {
            id
            ingested_at
            owner {
                address
            }
            recipient
            tags {
                name
                value
            }
        }
    }
`);

export type GetTransactionByIdQueryVariables = {
    id: string;
};

export type GetTransactionByIdQueryData = {
    transaction: GatewayTransaction;
};
