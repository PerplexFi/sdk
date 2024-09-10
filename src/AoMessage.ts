import { z } from 'zod';

import {
    GetTransactionByIdQuery,
    GetTransactionByIdQueryData,
    GetTransactionByIdQueryVariables,
    GetTransactionsQuery,
    GetTransactionsQueryData,
    GetTransactionsQueryVariables,
    queryGateway,
} from './utils/goldsky';
import { ZodArweaveId } from './utils/zod';

const AoMessageTagsSchema = z.array(
    z.object({
        name: z.string(),
        value: z.string(),
    }),
);

export type AoMessageTags = z.infer<typeof AoMessageTagsSchema>;

const AoMessageSchema = z.object({
    id: ZodArweaveId,
    owner: z.object({
        address: ZodArweaveId,
    }),
    recipient: ZodArweaveId,
    tags: AoMessageTagsSchema,
});
type AoMessageConstructor = z.infer<typeof AoMessageSchema>;

export class AoMessage {
    public readonly id: string;
    public readonly from: string;
    public readonly to: string;
    public readonly tags: Record<string, string>;

    constructor(data: AoMessageConstructor) {
        const { id, owner, recipient, tags } = AoMessageSchema.parse(data);

        this.id = id;
        this.from = owner.address;
        this.to = recipient;
        this.tags = Object.fromEntries(tags.map(({ name, value }) => [name, value]));
    }

    static makeTags(tags: Record<string, unknown>): AoMessageTags {
        return (
            Object.entries(tags)
                // Filter out tags with null/undefined value
                .filter(([, value]) => value !== null && value !== undefined)
                .map(([name, value]) => ({
                    name,
                    value: `${value}`,
                }))
        );
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
    isMessageValid: (msg: AoMessage) => boolean;
    pollArgs: { retryAfterMs: number; maxRetries: number };
}): Promise<AoMessage | null> {
    let min = Math.floor(Date.now() / 1000);

    for (let retryCount = 0; retryCount < args.pollArgs.maxRetries; retryCount += 1) {
        // 1. fetch
        const data = await queryGateway<GetTransactionsQueryData, GetTransactionsQueryVariables>(GetTransactionsQuery, {
            tagsFilter: args.tagsFilter,
            min,
        });

        const transactions = data?.transactions?.edges ?? [];
        for (const message of transactions) {
            const aoMessage = new AoMessage(message.node);
            if (args.isMessageValid(aoMessage)) {
                return aoMessage;
            }
        }
        min = transactions.reduce((acc, cur) => Math.max(acc, cur.node.ingested_at), min);

        await new Promise((resolve) => {
            // Sleep before trying again (minimum 100ms)
            setTimeout(resolve, Math.max(100, args.pollArgs.retryAfterMs));
        });
    }

    // Return null if nothing is found during the interval.
    return null;
}
