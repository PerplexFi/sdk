<h1>PerplexFi SDK</h1>

This repository contains the SDK for Perplex, designed to simplify integration and interaction with Perplex's services.

## Installation

```bash
npm install --save @perplexfi/sdk
```

## Usage

### Client instantiation

This SDK is using `aoconnect`'s methods under the hood, so you need to provide a valid signer to the client.

```ts
import { readFileSync } from 'fs';
import { PerplexClient } from '@perplexfi/sdk';

const walletAddress = '<insert wallet address>';

const wallet = JSON.parse(readFileSync(`/path/to/wallets/${walletAddress}.json`).toString());

const client = new PerplexClient(
    {
        /* The URL of the Perplex API */
        apiUrl: 'https://api.perplex.finance/graphql',

        /* You can set any gateway URL you want, we recommend using Goldsky's gateway */
        gatewayUrl: 'https://arweave-search.goldsky.com/graphql',

        /* Make sure the walletAddress corresponds to the wallet you're sending in createDataItemSigner */
        walletAddress,
    },
    createDataItemSigner(wallet),
);
```

### Set your cache

There are 2 "kinds" of cached data: hot and cold. Cold means data that is not updated frequently, like pool infos, token infos, ... Hot means data that is updated frequently, like wallet's balance, pool reserves, ...

You have different options to set your local cold cache:

-   Call `client.setCache()` with the result of a previous `PerplexClient.getColdCache()` call. Calling setCache creates a new Cache instance, which will erase all the hot infos stored! (ie. Pool reserves, wallet's balance, ...)
-   Call `client.initializeCache(['amm'])`
-   Manually call `await client.cache.fetchPoolInfos()`, `await client.fetchTokenInfos()`, ...

To set your local hot cache, you need to call the right methods (must be done after setting the cold cache):

-   `await client.updateAllPoolReserves()`
-   `await client.updateAllTokenBalances()`

```ts
// Previously...
const CACHED_INFOS = oldClient.cache.serialize();

// Later...
newClient.setCache(CACHED_INFOS);
```

```ts
await client.fetchPoolInfos();
```

### Create a constants file

We recommend fetching the constants once and store them once and for all in a file.

```ts
// constants.ts

export const POOLS = {
    FIRE_EARTH: '<fire/earth pool ID>',
    WATER_AIR: '<water/air pool ID>',
    AO_USDC: '<ao/usdc pool ID>',
    // ...
};

export const TOKENS = {
    FIRE: '<fire token ID>',
    EARTH: '<earth token ID>',
    WATER: '<water token ID>',
    AIR: '<air token ID>',
    // ...
};
```

To know what IDs to put in the constants file, you can call the following methods:

```ts
await client.initializeCache();
console.dir(client.search('ETH'), { depth: null });
```

`client.search('ETH')` will return an array of entities that match the `ETH` ticker (ie. ETH token, ETH/\* pools, ETH perp market, ETH/USDC spot market, ...)

### Make a swap

To make a swap, call the `swap` method on the client instance.

```ts
import { decimalToBigInt, bigIntToDecimal } from '@perplexfi/sdk';

import { POOLS, TOKENS } from './constants';

const fireToken = client.cache.getTokenById(TOKENS.FIRE);
const quantityIn = decimalToBigInt(0.1, fireToken.denomination);

// To be able to use `getSwapMinOutput`, you need to update the reserves first
await client.updatePoolReserves(POOLS.FIRE_EARTH);
const swapMinOutput = client.getSwapMinOutput({
    poolId: POOLS.FIRE_EARTH,
    tokenId: fireToken.id, // you can of course use `TOKENS.FIRE` aswell
    quantity: quantityIn,
    slippageTolerance: 0.05, // Percentage (eg. 5%)
});

if (swapMinOutput.ok) {
    const swap = await client.swap({
        poolId: POOLS.FIRE_EARTH,
        tokenId: fireToken.id,
        quantity: quantityIn,
        minOutput: swapMinOutput.data,
    });

    if (swap.ok) {
        console.log(
            [
                'Swap successful!',
                `    ID:     ${swap.data.id}`,
                `    Input:  ${bigIntToDecimal(swap.data.quantityIn, swap.data.tokenIn.denomination)} ${swap.data.tokenIn.ticker}`,
                `    Output: ${bigIntToDecimal(swap.data.quantityOut, swap.data.tokenOut.denomination)} ${swap.data.tokenOut.ticker}`,
                `    Fees:   ${bigIntToDecimal(swap.data.fees, swap.data.tokenOut.denomination)} ${swap.data.tokenOut.ticker}`,
                `    Price:  ${swap.data.price}`,
            ].join('\n'),
        );
    } else {
        console.error("Couldn't make the swap:", swap.error);
    }
} else {
    console.error("Couldn't get the min output for the swap:", swapMinOutput.error);
}
```

## License

This SDK is released under the MIT License. See [LICENSE](LICENSE) for more information.
