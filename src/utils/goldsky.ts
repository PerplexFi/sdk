import { gql } from './graphql';

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
