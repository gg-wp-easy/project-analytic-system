import type { TBankOption } from "../../../shared/api/tbank";
import { getOptionExpirationDateKey, getOptionSide } from "./options-helpers";

export type StrategyOutlook = "all" | "bullish" | "bearish" | "neutral";
export type StrategyTemplateId =
  | "custom"
  | "long-call"
  | "long-put"
  | "bull-call-spread"
  | "bear-put-spread"
  | "bear-call-spread"
  | "bull-put-spread"
  | "long-straddle"
  | "long-strangle"
  | "iron-condor";

export type StrategyTemplate = {
  id: StrategyTemplateId;
  name: {
    ru: string;
    en: string;
  };
  description: {
    ru: string;
    en: string;
  };
  outlook: Exclude<StrategyOutlook, "all">;
  legs: number;
};

export type StrategyLegAction = "buy" | "sell";

export type StrategyLeg = {
  option: TBankOption;
  action: StrategyLegAction;
  quantity: number;
  premium: number | null;
};

export type StrategyDraftLeg = {
  optionUid: string;
  action: StrategyLegAction;
  quantity: number;
};

export type StrategyPayoffPoint = {
  price: number;
  pnl: number;
};

export type StrategyBuildResult = {
  template: StrategyTemplate;
  expirationKey: string;
  referenceStrike: number;
  legs: StrategyLeg[];
  payoff: StrategyPayoffPoint[];
  breakEvenPrices: number[];
  maxProfit: number | null;
  maxLoss: number | null;
  netPremium: number | null;
  warnings: string[];
};

type OptionSide = "call" | "put";

type StrikeEntry = {
  strike: number;
  option: TBankOption;
};

type StrategyChain = {
  calls: StrikeEntry[];
  puts: StrikeEntry[];
  sharedStrikes: number[];
  allStrikes: number[];
  referenceStrike: number | null;
};

type CandidateLeg = {
  option: TBankOption;
  action: StrategyLegAction;
};

type BuildContext = {
  chain: StrategyChain;
};

const DEFAULT_PAYOFF_POINTS = 61;

export const CUSTOM_STRATEGY_TEMPLATE: StrategyTemplate = {
  id: "custom",
  name: {
    ru: "Пользовательская стратегия",
    en: "Custom Strategy",
  },
  description: {
    ru: "Ручная конфигурация ног стратегии на выбранной серии опционов.",
    en: "Manual strategy leg configuration on the selected option series.",
  },
  outlook: "neutral",
  legs: 0,
};

export const OPTIONS_STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: "long-call",
    name: { ru: "Long Call", en: "Long Call" },
    description: {
      ru: "Покупка call для умеренно бычьего сценария с ограниченным риском.",
      en: "Buy a call for a moderately bullish view with limited risk.",
    },
    outlook: "bullish",
    legs: 1,
  },
  {
    id: "bull-call-spread",
    name: { ru: "Bull Call Spread", en: "Bull Call Spread" },
    description: {
      ru: "Покупка call ближе к ATM и продажа call с более высоким страйком.",
      en: "Buy a call near ATM and sell a higher-strike call.",
    },
    outlook: "bullish",
    legs: 2,
  },
  {
    id: "bull-put-spread",
    name: { ru: "Bull Put Spread", en: "Bull Put Spread" },
    description: {
      ru: "Продажа put ближе к цене и покупка защитного put ниже.",
      en: "Sell a put closer to the market and buy a lower protective put.",
    },
    outlook: "bullish",
    legs: 2,
  },
  {
    id: "long-put",
    name: { ru: "Long Put", en: "Long Put" },
    description: {
      ru: "Покупка put для медвежьего сценария с ограниченным риском.",
      en: "Buy a put for a bearish view with limited risk.",
    },
    outlook: "bearish",
    legs: 1,
  },
  {
    id: "bear-put-spread",
    name: { ru: "Bear Put Spread", en: "Bear Put Spread" },
    description: {
      ru: "Покупка put ближе к ATM и продажа put с более низким страйком.",
      en: "Buy a put near ATM and sell a lower-strike put.",
    },
    outlook: "bearish",
    legs: 2,
  },
  {
    id: "bear-call-spread",
    name: { ru: "Bear Call Spread", en: "Bear Call Spread" },
    description: {
      ru: "Продажа call ближе к цене и покупка защитного call выше.",
      en: "Sell a call closer to the market and buy a higher protective call.",
    },
    outlook: "bearish",
    legs: 2,
  },
  {
    id: "long-straddle",
    name: { ru: "Long Straddle", en: "Long Straddle" },
    description: {
      ru: "Покупка call и put на одном страйке в ожидании сильного движения.",
      en: "Buy a call and a put at the same strike for a large move either way.",
    },
    outlook: "neutral",
    legs: 2,
  },
  {
    id: "long-strangle",
    name: { ru: "Long Strangle", en: "Long Strangle" },
    description: {
      ru: "Покупка put ниже и call выше центральной зоны страйков.",
      en: "Buy a lower put and a higher call around the center strike area.",
    },
    outlook: "neutral",
    legs: 2,
  },
  {
    id: "iron-condor",
    name: { ru: "Iron Condor", en: "Iron Condor" },
    description: {
      ru: "Нейтральная четырёхногая конструкция из двух кредитных спредов.",
      en: "A neutral four-leg construction made of two credit spreads.",
    },
    outlook: "neutral",
    legs: 4,
  },
];

function compareOptions(left: TBankOption, right: TBankOption): number {
  const tradableDiff = Number(right.apiTradeAvailableFlag) - Number(left.apiTradeAvailableFlag);
  if (tradableDiff !== 0) {
    return tradableDiff;
  }

  const lotDiff = (right.lot || 0) - (left.lot || 0);
  if (lotDiff !== 0) {
    return lotDiff;
  }

  return left.ticker.localeCompare(right.ticker, "ru");
}

function uniqueSortedNumbers(values: number[]): number[] {
  return [...new Set(values.filter((value) => Number.isFinite(value)))].sort((left, right) => left - right);
}

function dedupeOptionsByStrike(options: TBankOption[], side: OptionSide): StrikeEntry[] {
  const map = new Map<number, TBankOption>();

  for (const option of options) {
    if (getOptionSide(option) !== side || !Number.isFinite(option.strikePrice)) {
      continue;
    }

    const current = map.get(option.strikePrice);
    if (!current || compareOptions(option, current) < 0) {
      map.set(option.strikePrice, option);
    }
  }

  return [...map.entries()]
    .map(([strike, option]) => ({ strike, option }))
    .sort((left, right) => left.strike - right.strike);
}

function getMedianStrike(strikes: number[]): number | null {
  if (strikes.length === 0) {
    return null;
  }

  const middleIndex = Math.floor(strikes.length / 2);
  if (strikes.length % 2 === 1) {
    return strikes[middleIndex] ?? null;
  }

  const left = strikes[middleIndex - 1];
  const right = strikes[middleIndex];
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return null;
  }

  return (left + right) / 2;
}

function findClosestStrike(strikes: number[], target: number | null): number | null {
  if (strikes.length === 0) {
    return null;
  }

  if (!Number.isFinite(target ?? Number.NaN)) {
    return strikes[0] ?? null;
  }

  return strikes.reduce((best, current) => {
    if (best === null) {
      return current;
    }

    const currentDistance = Math.abs(current - target!);
    const bestDistance = Math.abs(best - target!);
    if (currentDistance !== bestDistance) {
      return currentDistance < bestDistance ? current : best;
    }

    return current < best ? current : best;
  }, null as number | null);
}

function buildStrategyChain(options: TBankOption[], expirationKey: string): StrategyChain {
  const filtered = getOptionsForExpiration(options, expirationKey);
  const calls = dedupeOptionsByStrike(filtered, "call");
  const puts = dedupeOptionsByStrike(filtered, "put");
  const callStrikes = calls.map((entry) => entry.strike);
  const putStrikes = puts.map((entry) => entry.strike);
  const sharedStrikes = callStrikes.filter((strike) => putStrikes.includes(strike));
  const allStrikes = uniqueSortedNumbers([...callStrikes, ...putStrikes]);
  const referenceBase = getMedianStrike(allStrikes);
  const referenceStrike = findClosestStrike(sharedStrikes.length > 0 ? sharedStrikes : allStrikes, referenceBase);

  return {
    calls,
    puts,
    sharedStrikes: uniqueSortedNumbers(sharedStrikes),
    allStrikes,
    referenceStrike,
  };
}

function findNearestEntry(entries: StrikeEntry[], target: number | null): StrikeEntry | null {
  if (entries.length === 0) {
    return null;
  }

  const targetStrike = target ?? entries[0]?.strike ?? null;
  if (!Number.isFinite(targetStrike ?? Number.NaN)) {
    return entries[0] ?? null;
  }

  return entries.reduce<StrikeEntry | null>((best, entry) => {
    if (!best) {
      return entry;
    }

    const currentDistance = Math.abs(entry.strike - targetStrike!);
    const bestDistance = Math.abs(best.strike - targetStrike!);
    if (currentDistance !== bestDistance) {
      return currentDistance < bestDistance ? entry : best;
    }

    return entry.strike < best.strike ? entry : best;
  }, null);
}

function findEntryAtOrBelow(entries: StrikeEntry[], target: number | null, strict = false): StrikeEntry | null {
  const filtered = entries.filter((entry) =>
    strict ? entry.strike < (target ?? Number.POSITIVE_INFINITY) : entry.strike <= (target ?? Number.POSITIVE_INFINITY),
  );
  return filtered[filtered.length - 1] ?? null;
}

function findEntryAtOrAbove(entries: StrikeEntry[], target: number | null, strict = false): StrikeEntry | null {
  const filtered = entries.filter((entry) =>
    strict ? entry.strike > (target ?? Number.NEGATIVE_INFINITY) : entry.strike >= (target ?? Number.NEGATIVE_INFINITY),
  );
  return filtered[0] ?? null;
}

function findSiblingEntry(entries: StrikeEntry[], anchorStrike: number, direction: "lower" | "higher"): StrikeEntry | null {
  const index = entries.findIndex((entry) => entry.strike === anchorStrike);
  if (index < 0) {
    return null;
  }

  return direction === "lower" ? entries[index - 1] ?? null : entries[index + 1] ?? null;
}

function buildLongCall(context: BuildContext): CandidateLeg[] | null {
  const entry = findNearestEntry(context.chain.calls, context.chain.referenceStrike);
  return entry ? [{ option: entry.option, action: "buy" }] : null;
}

function buildLongPut(context: BuildContext): CandidateLeg[] | null {
  const entry = findNearestEntry(context.chain.puts, context.chain.referenceStrike);
  return entry ? [{ option: entry.option, action: "buy" }] : null;
}

function buildBullCallSpread(context: BuildContext): CandidateLeg[] | null {
  const longCall =
    findEntryAtOrBelow(context.chain.calls, context.chain.referenceStrike) ??
    findNearestEntry(context.chain.calls, context.chain.referenceStrike);
  if (!longCall) {
    return null;
  }

  const shortCall = findSiblingEntry(context.chain.calls, longCall.strike, "higher");
  if (!shortCall) {
    return null;
  }

  return [
    { option: longCall.option, action: "buy" },
    { option: shortCall.option, action: "sell" },
  ];
}

function buildBearCallSpread(context: BuildContext): CandidateLeg[] | null {
  const shortCall =
    findEntryAtOrAbove(context.chain.calls, context.chain.referenceStrike) ??
    findNearestEntry(context.chain.calls, context.chain.referenceStrike);
  if (!shortCall) {
    return null;
  }

  const longCall = findSiblingEntry(context.chain.calls, shortCall.strike, "higher");
  if (!longCall) {
    return null;
  }

  return [
    { option: shortCall.option, action: "sell" },
    { option: longCall.option, action: "buy" },
  ];
}

function buildBearPutSpread(context: BuildContext): CandidateLeg[] | null {
  const longPut =
    findEntryAtOrAbove(context.chain.puts, context.chain.referenceStrike) ??
    findNearestEntry(context.chain.puts, context.chain.referenceStrike);
  if (!longPut) {
    return null;
  }

  const shortPut = findSiblingEntry(context.chain.puts, longPut.strike, "lower");
  if (!shortPut) {
    return null;
  }

  return [
    { option: longPut.option, action: "buy" },
    { option: shortPut.option, action: "sell" },
  ];
}

function buildBullPutSpread(context: BuildContext): CandidateLeg[] | null {
  const shortPut =
    findEntryAtOrBelow(context.chain.puts, context.chain.referenceStrike) ??
    findNearestEntry(context.chain.puts, context.chain.referenceStrike);
  if (!shortPut) {
    return null;
  }

  const longPut = findSiblingEntry(context.chain.puts, shortPut.strike, "lower");
  if (!longPut) {
    return null;
  }

  return [
    { option: shortPut.option, action: "sell" },
    { option: longPut.option, action: "buy" },
  ];
}

function buildLongStraddle(context: BuildContext): CandidateLeg[] | null {
  const sharedStrike = findClosestStrike(context.chain.sharedStrikes, context.chain.referenceStrike);
  if (!Number.isFinite(sharedStrike ?? Number.NaN)) {
    return null;
  }

  const call = context.chain.calls.find((entry) => entry.strike === sharedStrike);
  const put = context.chain.puts.find((entry) => entry.strike === sharedStrike);
  if (!call || !put) {
    return null;
  }

  return [
    { option: call.option, action: "buy" },
    { option: put.option, action: "buy" },
  ];
}

function buildLongStrangle(context: BuildContext): CandidateLeg[] | null {
  const put =
    findEntryAtOrBelow(context.chain.puts, context.chain.referenceStrike, true) ??
    findEntryAtOrBelow(context.chain.puts, context.chain.referenceStrike);
  const call =
    findEntryAtOrAbove(context.chain.calls, context.chain.referenceStrike, true) ??
    findEntryAtOrAbove(context.chain.calls, context.chain.referenceStrike);

  if (!put || !call) {
    return null;
  }

  return [
    { option: put.option, action: "buy" },
    { option: call.option, action: "buy" },
  ];
}

function buildIronCondor(context: BuildContext): CandidateLeg[] | null {
  const shortPut =
    findEntryAtOrBelow(context.chain.puts, context.chain.referenceStrike, true) ??
    findEntryAtOrBelow(context.chain.puts, context.chain.referenceStrike);
  const shortCall =
    findEntryAtOrAbove(context.chain.calls, context.chain.referenceStrike, true) ??
    findEntryAtOrAbove(context.chain.calls, context.chain.referenceStrike);

  if (!shortPut || !shortCall) {
    return null;
  }

  const longPut = findSiblingEntry(context.chain.puts, shortPut.strike, "lower");
  const longCall = findSiblingEntry(context.chain.calls, shortCall.strike, "higher");

  if (!longPut || !longCall) {
    return null;
  }

  return [
    { option: longPut.option, action: "buy" },
    { option: shortPut.option, action: "sell" },
    { option: shortCall.option, action: "sell" },
    { option: longCall.option, action: "buy" },
  ];
}

const STRATEGY_BUILDERS: Record<Exclude<StrategyTemplateId, "custom">, (context: BuildContext) => CandidateLeg[] | null> = {
  "long-call": buildLongCall,
  "long-put": buildLongPut,
  "bull-call-spread": buildBullCallSpread,
  "bear-put-spread": buildBearPutSpread,
  "bear-call-spread": buildBearCallSpread,
  "bull-put-spread": buildBullPutSpread,
  "long-straddle": buildLongStraddle,
  "long-strangle": buildLongStrangle,
  "iron-condor": buildIronCondor,
};

function resolveOptionPremium(option: TBankOption, closePricesById: Record<string, number>): number | null {
  const candidates = [
    option.figi,
    option.uid,
    option.positionUid,
    option.classCode && option.ticker ? `${option.ticker}_${option.classCode}` : "",
  ];

  for (const candidate of candidates) {
    const value = closePricesById[candidate];
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function getContractMultiplier(option: TBankOption): number {
  return Number.isFinite(option.lot) && option.lot > 0 ? option.lot : 1;
}

function getLegIntrinsic(option: TBankOption, price: number): number {
  const side = getOptionSide(option);
  if (side === "call") {
    return Math.max(price - option.strikePrice, 0);
  }
  if (side === "put") {
    return Math.max(option.strikePrice - price, 0);
  }
  return 0;
}

function evaluateLegPnl(leg: StrategyLeg, price: number): number {
  const intrinsic = getLegIntrinsic(leg.option, price);
  const premium = leg.premium ?? 0;
  const multiplier = getContractMultiplier(leg.option) * leg.quantity;
  const perUnitPnl = leg.action === "buy" ? intrinsic - premium : premium - intrinsic;
  return perUnitPnl * multiplier;
}

function evaluateStrategyPnl(legs: StrategyLeg[], price: number): number {
  return legs.reduce((sum, leg) => sum + evaluateLegPnl(leg, price), 0);
}

function buildPayoffSeries(legs: StrategyLeg[], referenceStrike: number): StrategyPayoffPoint[] {
  const strikes = uniqueSortedNumbers(legs.map((leg) => leg.option.strikePrice));
  const highestStrike = Math.max(referenceStrike, strikes[strikes.length - 1] ?? referenceStrike, 1);
  const upperBound = Math.max(highestStrike * 1.8, highestStrike + 1);
  const points: StrategyPayoffPoint[] = [];

  for (let index = 0; index < DEFAULT_PAYOFF_POINTS; index += 1) {
    const ratio = DEFAULT_PAYOFF_POINTS === 1 ? 0 : index / (DEFAULT_PAYOFF_POINTS - 1);
    const price = ratio * upperBound;
    points.push({
      price,
      pnl: evaluateStrategyPnl(legs, price),
    });
  }

  return points;
}

function pushApproxUnique(values: number[], candidate: number): void {
  if (!Number.isFinite(candidate)) {
    return;
  }

  const alreadyPresent = values.some((value) => Math.abs(value - candidate) < 1e-6);
  if (!alreadyPresent) {
    values.push(candidate);
  }
}

function findBreakEvenPrices(legs: StrategyLeg[], payoff: StrategyPayoffPoint[]): number[] {
  const strikes = uniqueSortedNumbers(legs.map((leg) => leg.option.strikePrice));
  const upperBound = payoff[payoff.length - 1]?.price ?? Math.max(...strikes, 1);
  const checkpoints = uniqueSortedNumbers([0, ...strikes, upperBound]);
  const roots: number[] = [];

  for (let index = 0; index < checkpoints.length; index += 1) {
    const leftX = checkpoints[index];
    const leftY = evaluateStrategyPnl(legs, leftX);

    if (Math.abs(leftY) < 1e-8) {
      pushApproxUnique(roots, leftX);
    }

    const rightX = checkpoints[index + 1];
    if (!Number.isFinite(rightX)) {
      continue;
    }

    const rightY = evaluateStrategyPnl(legs, rightX);
    if (Math.abs(rightY) < 1e-8) {
      pushApproxUnique(roots, rightX);
      continue;
    }

    if (leftY === rightY || leftY * rightY > 0) {
      continue;
    }

    const ratio = leftY / (leftY - rightY);
    pushApproxUnique(roots, leftX + (rightX - leftX) * ratio);
  }

  return roots.sort((left, right) => left - right);
}

function getUpperTailSlope(legs: StrategyLeg[]): number {
  return legs.reduce((sum, leg) => {
    const side = getOptionSide(leg.option);
    if (side !== "call") {
      return sum;
    }

    const direction = leg.action === "buy" ? 1 : -1;
    return sum + direction * getContractMultiplier(leg.option) * leg.quantity;
  }, 0);
}

function getFiniteExtremum(points: StrategyPayoffPoint[], type: "min" | "max"): number | null {
  if (points.length === 0) {
    return null;
  }

  return points.reduce((best, point) => {
    if (best === null) {
      return point.pnl;
    }
    return type === "max" ? Math.max(best, point.pnl) : Math.min(best, point.pnl);
  }, null as number | null);
}

function buildResultFromLegs(params: {
  template: StrategyTemplate;
  expirationKey: string;
  referenceStrike: number;
  legs: Array<{ option: TBankOption; action: StrategyLegAction; quantity: number }>;
  closePricesById: Record<string, number>;
}): StrategyBuildResult | null {
  if (params.legs.length === 0) {
    return null;
  }

  const legs: StrategyLeg[] = params.legs.map((leg) => ({
    option: leg.option,
    action: leg.action,
    quantity: Number.isFinite(leg.quantity) && leg.quantity > 0 ? Math.max(1, Math.floor(leg.quantity)) : 1,
    premium: resolveOptionPremium(leg.option, params.closePricesById),
  }));

  const warnings: string[] = [];
  if (legs.some((leg) => leg.premium === null)) {
    warnings.push("missing-close-prices");
  }

  const payoff = buildPayoffSeries(legs, params.referenceStrike);
  const breakEvenPrices = findBreakEvenPrices(legs, payoff);
  const upperTailSlope = getUpperTailSlope(legs);
  const netPremiumKnown = legs.every((leg) => leg.premium !== null);
  const netPremium = netPremiumKnown
    ? legs.reduce((sum, leg) => {
        const premium = leg.premium ?? 0;
        const direction = leg.action === "buy" ? -1 : 1;
        return sum + premium * getContractMultiplier(leg.option) * leg.quantity * direction;
      }, 0)
    : null;

  const maxProfit = upperTailSlope > 0 ? Number.POSITIVE_INFINITY : getFiniteExtremum(payoff, "max");
  const maxLoss = upperTailSlope < 0 ? Number.POSITIVE_INFINITY : getFiniteExtremum(payoff, "min");

  return {
    template: params.template,
    expirationKey: params.expirationKey,
    referenceStrike: params.referenceStrike,
    legs,
    payoff,
    breakEvenPrices,
    maxProfit,
    maxLoss,
    netPremium,
    warnings,
  };
}

function getTemplate(id: Exclude<StrategyTemplateId, "custom">): StrategyTemplate {
  return OPTIONS_STRATEGY_TEMPLATES.find((template) => template.id === id) ?? OPTIONS_STRATEGY_TEMPLATES[0]!;
}

export function getOptionsForExpiration(options: TBankOption[], expirationKey: string): TBankOption[] {
  return options
    .filter((option) => getOptionExpirationDateKey(option) === expirationKey)
    .sort((left, right) => {
      if (left.strikePrice !== right.strikePrice) {
        return left.strikePrice - right.strikePrice;
      }

      const sideDiff = getOptionSide(left).localeCompare(getOptionSide(right), "en");
      if (sideDiff !== 0) {
        return sideDiff;
      }

      return left.ticker.localeCompare(right.ticker, "ru");
    });
}

export function getStrategyTemplatesByOutlook(outlook: StrategyOutlook): StrategyTemplate[] {
  return outlook === "all"
    ? OPTIONS_STRATEGY_TEMPLATES
    : OPTIONS_STRATEGY_TEMPLATES.filter((template) => template.outlook === outlook);
}

export function buildStrategyFromTemplate(params: {
  options: TBankOption[];
  expirationKey: string;
  templateId: Exclude<StrategyTemplateId, "custom">;
  closePricesById: Record<string, number>;
  contracts?: number;
}): StrategyBuildResult | null {
  const template = getTemplate(params.templateId);
  const chain = buildStrategyChain(params.options, params.expirationKey);
  if (!chain.referenceStrike) {
    return null;
  }

  const build = STRATEGY_BUILDERS[params.templateId];
  const candidateLegs = build({ chain });
  if (!candidateLegs || candidateLegs.length === 0) {
    return null;
  }

  const contracts = Number.isFinite(params.contracts) && (params.contracts ?? 0) > 0
    ? Math.max(1, Math.floor(params.contracts!))
    : 1;

  return buildResultFromLegs({
    template: { ...template, legs: candidateLegs.length },
    expirationKey: params.expirationKey,
    referenceStrike: chain.referenceStrike,
    legs: candidateLegs.map((leg) => ({
      option: leg.option,
      action: leg.action,
      quantity: contracts,
    })),
    closePricesById: params.closePricesById,
  });
}

export function buildStrategyFromCustomLegs(params: {
  options: TBankOption[];
  expirationKey: string;
  legs: StrategyDraftLeg[];
  closePricesById: Record<string, number>;
}): StrategyBuildResult | null {
  const seriesOptions = getOptionsForExpiration(params.options, params.expirationKey);
  const optionsByUid = new Map(seriesOptions.map((option) => [option.uid, option]));

  const resolvedLegs = params.legs
    .map((leg) => {
      const option = optionsByUid.get(leg.optionUid);
      if (!option) {
        return null;
      }

      return {
        option,
        action: leg.action,
        quantity: leg.quantity,
      };
    })
    .filter((leg): leg is { option: TBankOption; action: StrategyLegAction; quantity: number } => Boolean(leg));

  if (resolvedLegs.length === 0) {
    return null;
  }

  const referenceStrike = getMedianStrike(
    uniqueSortedNumbers(resolvedLegs.map((leg) => leg.option.strikePrice)),
  ) ?? resolvedLegs[0]!.option.strikePrice;

  return buildResultFromLegs({
    template: {
      ...CUSTOM_STRATEGY_TEMPLATE,
      legs: resolvedLegs.length,
    },
    expirationKey: params.expirationKey,
    referenceStrike,
    legs: resolvedLegs,
    closePricesById: params.closePricesById,
  });
}
