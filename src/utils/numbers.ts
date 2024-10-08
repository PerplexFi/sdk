export function decimalToBigInt(nb: number | string, denomination: number): bigint {
    const value = nb.toString();
    if (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value)) {
        throw new Error('Invalid value');
    }

    const [intPart, decPart = ''] = value.split('.');

    return BigInt(intPart + decPart.slice(0, denomination).padEnd(denomination, '0'));
}

export function bigIntToDecimal(value: bigint, denomination: number): string {
    const valueAsString = value.toString();

    if (valueAsString.length <= denomination) {
        return `0.${valueAsString.padStart(denomination, '0')}`;
    }
    const intPart = valueAsString.slice(0, -denomination);
    const decPart = valueAsString.slice(-denomination).replace(/0+$/, '');

    return decPart ? `${intPart}.${decPart}` : intPart;
}

export function roundToTick(value: bigint, tickSize: bigint): bigint {
    return ((value + tickSize / 2n) / tickSize) * tickSize;
}
