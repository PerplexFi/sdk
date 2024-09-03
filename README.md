<h1>PerplexFi SDK</h1>

This repository contains the SDK for Perplex, designed to simplify integration and interaction with Perplex's services.

## Installation

```bash
npm install --save @perplexfi/sdk
```

## Usage

We recommend you to directly use our Aetheris Tokens and Pools

```ts
import { Aetheris } from '@perplexfi/sdk';
```

### How to make a swap?

To make a swap, you need a pool

```ts
const pool = Aetheris.Pools.AIR_EARTH;
```

Then you can make a swap using the `swap` method. The `swap` method takes the following parameters:

-   `signer`: cf. aoconnect's [createDataItemSigner](https://github.com/permaweb/ao/tree/main/connect#createdataitemsigner)
-   `input`: a TokenQuantity of one of the pool's tokens
-   `minExpectedOutput`: a TokenQuantity of the other token, reprensenting the minimum expected output _(slippage protection)_

```ts
// Specify your input amount
const input = Aetheris.Tokens.AIR.fromReadable('0.02');

// Required by `getExpectedOutput`
await pool.updateReserves();

// 0.02 represents 2% slippage tolerance.
// This method requires the pool to have up-to-date reserves, hence the `updateReserves` call above.
const minExpectedOutput = pool.getExpectedOutput(input, 0.02);

// This method signs and sends only 1 transaction: the Transfer of `input`
const swap = await pool.swap({
    signer: createDataItemSigner(wallet),
    input,
    minExpectedOutput,
});

// Here the swap should be successful, if anything wrong happens, an error will be thrown
```

## License

This SDK is released under the MIT License. See [LICENSE](LICENSE) for more information.
