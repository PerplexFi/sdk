type GqlTransactionFragment = {
    id: string;
    recipient: string;
    owner: {
        address: string;
    };
    tags: Array<{
        name: string;
        value: string;
    }>;
};

export class AoMessage {
    public readonly id: string;
    public readonly from: string;
    public readonly to: string;
    public readonly tags: Record<string, string>;

    constructor(data: GqlTransactionFragment) {
        this.id = data.id;
        this.from = data.owner.address;
        this.to = data.recipient;
        this.tags = Object.fromEntries(data.tags.map(({ name, value }) => [name, value]));
    }

    static toTagsArray(tags: Record<string, NonNullable<unknown>>): Array<{ name: string; value: string }> {
        return Object.entries(tags).map(([name, value]) => ({
            name,
            value: `${value}`,
        }));
    }
}

const GetTransactionsQuery = /* GraphQL */ `
    query transactions($tagsFilter: [TagFilter!]!, $min: Int!) {
        transactions(
            first: 100
            sort: INGESTED_AT_ASC
            ingested_at: { min: $min }
            tags: $tagsFilter
        ) {
            edges {
                node {
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
        }
    }
`
    .replace(/(#.*)/g, '') // Remove comments (if any)
    .replace(/\s+/g, ' ') // Remove useless spaces/newlines
    .trim();

/**
 * This function expects only one message to be matching the tags.
 * If more are found only the first message is returned.
 */
export async function lookForMessage(args: {
    tagsFilter: Array<{ name: string; values: string[] }>;
    pollArgs: { retryAfterMs: number; maxRetries: number };
}): Promise<AoMessage | null> {
    const min = Math.floor(Date.now() / 1000);
    for (let retryCount = 0; retryCount < args.pollArgs.maxRetries; retryCount += 1) {
        // 1. fetch
        const res = await fetch('https://arweave-search.goldsky.com/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: GetTransactionsQuery,
                variables: {
                    tagsFilter: args.tagsFilter,
                    min,
                },
            }),
        }).then((r) => r.json());

        const message = res?.data?.transactions?.edges?.at(0);
        if (message) {
            return message;
        }

        await new Promise((resolve) => {
            // Sleep before trying again
            setTimeout(resolve, args.pollArgs.retryAfterMs);
        });
    }

    // Return null if nothing is found during the interval.
    return null;
}
