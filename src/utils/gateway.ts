import { gql } from './graphql';

const TransactionFragment = gql(`
    fragment TransactionFragment on Transaction {
        id
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

    query transactions($tagsFilter: [TagFilter!]!, $after: String) {
        transactions(
            first: 100,
            after: $after
            tags: $tagsFilter
        ) {
            pageInfo {
                hasNextPage
            }
            edges {
                cursor
                node {
                    ...TransactionFragment
                }
            }
        }
    }
`);

export type GetTransactionsQueryVariables = {
    tagsFilter: Array<{ name: string; values: string[] }>;
    after?: string | null;
};

export type GetTransactionsQueryData = {
    transactions: {
        pageInfo: { hasNextPage: boolean };
        edges: Array<{ cursor: string; node: GatewayTransaction }>;
    };
};
