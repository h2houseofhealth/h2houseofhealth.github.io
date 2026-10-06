'use strict';

// Currency helpers for the INR/USD toggle.
// All prices are stored in INR paise. USD is a display/charge conversion at a
// fixed rate (INR_PER_USD, default 85) - this is not a live FX rate.

const DEFAULT_CURRENCY = 'INR';
const SUPPORTED_CURRENCIES = ['INR', 'USD'];
const FALLBACK_INR_PER_USD = 85;

function getInrPerUsd() {
  const rate = Number(process.env.INR_PER_USD);
  return Number.isFinite(rate) && rate > 0 ? rate : FALLBACK_INR_PER_USD;
}

function normalizeCurrency(value) {
  const code = String(value || '').trim().toUpperCase();
  return SUPPORTED_CURRENCIES.includes(code) ? code : DEFAULT_CURRENCY;
}

function getCurrencyConfig() {
  return {
    defaultCurrency: DEFAULT_CURRENCY,
    supportedCurrencies: [...SUPPORTED_CURRENCIES],
    inrPerUsd: getInrPerUsd(),
  };
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

// Converts an INR amount in paise into what the customer is actually charged.
//   originalInrAmount: rupees (2dp)
//   chargedAmount:     major units of the charge currency (rupees or dollars, 2dp)
//   razorpayAmount:    minor units of the charge currency (paise or cents, integer)
//   exchangeRate:      INR per 1 unit of the charge currency (1 for INR)
function convertInrPaiseToCurrency(amountInPaise, currency) {
  const paise = Math.round(Number(amountInPaise));
  if (!Number.isFinite(paise) || paise < 0) {
    throw new RangeError(`Invalid amount for currency conversion: ${amountInPaise}`);
  }

  const originalInrAmount = roundMoney(paise / 100);
  const code = normalizeCurrency(currency);

  if (code === 'USD') {
    const rate = getInrPerUsd();
    const cents = Math.round(paise / rate);
    return {
      currency: 'USD',
      exchangeRate: rate,
      originalInrAmount,
      chargedAmount: roundMoney(cents / 100),
      razorpayAmount: cents,
    };
  }

  return {
    currency: 'INR',
    exchangeRate: 1,
    originalInrAmount,
    chargedAmount: originalInrAmount,
    razorpayAmount: paise,
  };
}

module.exports = {
  convertInrPaiseToCurrency,
  normalizeCurrency,
  getCurrencyConfig,
};
