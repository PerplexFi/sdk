import { z } from 'zod';

import { GetTransactionsQuery, GetTransactionsQueryData, GetTransactionsQueryVariables } from './utils/gateway';
import { queryGraphQL } from './utils/graphql';
import { ZodArweaveId } from './utils/zod';

const ArweaveTxTagSchema = z.object({
    name: z.string(),
    value: z.string(),
});

export type ArweaveTxTag = z.infer<typeof ArweaveTxTagSchema>;

export type AoConnectMessage = {
    Tags: {
        name: string;
        value: string;
    }[];
    Data?: string;
    Target: string;
    Anchor: string;
};

const ArweaveTxSchema = z.object({
    id: ZodArweaveId,
    owner: z.object({
        address: ZodArweaveId,
    }),
    recipient: ZodArweaveId,
    tags: z.array(ArweaveTxTagSchema),
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

export function makeArweaveTxTags(tags: Record<string, unknown>): ArweaveTxTag[] {
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
    tagsFilter: Array<[string, unknown[]]>; // Order is important, put most restrictive to least restrictive tag for better perfs
    isMessageValid: (msg: AoMessage) => boolean;
    pollArgs: { gatewayUrl: string; retryAfterMs: number; maxRetries: number };
}): Promise<AoMessage | null> {
    for (let retryCount = 0; retryCount < args.pollArgs.maxRetries; retryCount += 1) {
        let after: string | undefined;
        let hasNextPage = true;

        while (hasNextPage) {
            const data = await queryGraphQL<GetTransactionsQueryData, GetTransactionsQueryVariables>(
                args.pollArgs.gatewayUrl,
                GetTransactionsQuery,
                {
                    tagsFilter: args.tagsFilter
                        .map(([name, values]) => ({
                            name,
                            values: values.filter((val) => val !== null && val !== undefined).map((val) => `${val}`),
                        }))
                        .filter(({ values }) => values.length > 0),
                    after,
                },
            );

            hasNextPage = data.transactions.pageInfo.hasNextPage;

            const txs = data?.transactions?.edges ?? [];
            for (const { node: transaction } of txs) {
                const aoMessage = arweaveTxToAoMessage(transaction);
                if (args.isMessageValid(aoMessage)) {
                    return aoMessage;
                }
            }
            after = txs.at(-1)?.cursor;
        }

        await new Promise((resolve) => {
            // Sleep before trying again (minimum 100ms)
            setTimeout(resolve, Math.max(100, args.pollArgs.retryAfterMs));
        });
    }

    // Return null if nothing is found during the interval.
    return null;
}
