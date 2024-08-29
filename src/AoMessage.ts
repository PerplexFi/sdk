import {
    GetTransactionByIdQuery,
    GetTransactionByIdQueryData,
    GetTransactionByIdQueryVariables,
    GetTransactionsQuery,
    GetTransactionsQueryData,
    GetTransactionsQueryVariables,
    queryGateway,
} from './utils/goldsky';

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

    static async getById(messageId: string): Promise<AoMessage | null> {
        const data = await queryGateway<GetTransactionByIdQueryData, GetTransactionByIdQueryVariables>(
            GetTransactionByIdQuery,
            { id: messageId },
        );

        if (data.transaction) {
            return new AoMessage(data.transaction);
        }

        return null;
    }
}

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
        const data = await queryGateway<GetTransactionsQueryData, GetTransactionsQueryVariables>(GetTransactionsQuery, {
            tagsFilter: args.tagsFilter,
            min,
        });

        const message = data?.transactions?.edges?.at(0);
        if (message) {
            return new AoMessage(message.node);
        }

        await new Promise((resolve) => {
            // Sleep before trying again
            setTimeout(resolve, args.pollArgs.retryAfterMs);
        });
    }

    // Return null if nothing is found during the interval.
    return null;
}
