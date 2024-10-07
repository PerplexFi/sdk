import { z } from 'zod';

import { GetTransactionsQuery, GetTransactionsQueryData, GetTransactionsQueryVariables } from './utils/goldsky';
import { queryGraphQL } from './utils/graphql';
import { ZodArweaveId } from './utils/zod';

const ArweaveTxTagsSchema = z.array(
    z.object({
        name: z.string(),
        value: z.string(),
    }),
);

export type ArweaveTxTags = z.infer<typeof ArweaveTxTagsSchema>;

const ArweaveTxSchema = z.object({
    id: ZodArweaveId,
    owner: z.object({
        address: ZodArweaveId,
    }),
    recipient: ZodArweaveId,
    tags: ArweaveTxTagsSchema,
});
type ArweaveTx = z.infer<typeof ArweaveTxSchema>;

type AoMessage = {
    id: string;
    from: string;
    to: string;
    tags: Record<string, string>;
};

export function arweaveTxToAoMessage(transaction: ArweaveTx): AoMessage {
    const { id, owner, recipient, tags } = ArweaveTxSchema.parse(transaction);

    return {
        id,
        from: owner.address,
        to: recipient,
        tags: Object.fromEntries(tags.map(({ name, value }) => [name, value])),
    };
}

export function makeArweaveTxTags(tags: Record<string, unknown>): ArweaveTxTags {
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
        const data = await queryGraphQL<GetTransactionsQueryData, GetTransactionsQueryVariables>(
            'https://arweave-search.goldsky.com/graphql',
            GetTransactionsQuery,
            {
                tagsFilter: args.tagsFilter,
                min,
            },
        );

        const transactions = data?.transactions?.edges ?? [];
        for (const { node: transaction } of transactions) {
            const aoMessage = arweaveTxToAoMessage(transaction);
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
