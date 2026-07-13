import type { TBankOption } from "../../../shared/api/tbank";
import { DEFAULT_PAYOFF_POINTS } from "../model";
import type {
  StrategyBuildResult,
  StrategyHelp,
  StrategyLeg,
  StrategyLegAction,
  StrategyOutlook,
  StrategyPayoffPoint,
  StrategyTemplate,
  StrategyTemplateId,
} from "../model";
import { getOptionExpirationDateKey, getOptionSide } from "./options-helpers";

export type {
  StrategyBuildResult,
  StrategyDraftLeg,
  StrategyHelp,
  StrategyLeg,
  StrategyLegAction,
  StrategyOutlook,
  StrategyPayoffPoint,
  StrategyTemplate,
  StrategyTemplateId,
} from "../model";

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
  quantity?: number;
};

type BuildContext = {
  chain: StrategyChain;
};

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
    id: "short-call",
    name: { ru: "Short Call", en: "Short Call" },
    description: {
      ru: "Продажа call около центрального страйка для медвежьего или нейтрального сценария.",
      en: "Sell a call near the center strike for a bearish or neutral view.",
    },
    outlook: "bearish",
    legs: 1,
  },
  {
    id: "synthetic-long",
    name: { ru: "Synthetic Long", en: "Synthetic Long" },
    description: {
      ru: "Покупка call и продажа put на одном страйке для синтетической длинной позиции.",
      en: "Buy a call and sell a put at the same strike to create synthetic long exposure.",
    },
    outlook: "bullish",
    legs: 2,
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
    id: "call-ratio-backspread",
    name: { ru: "Call Ratio Backspread", en: "Call Ratio Backspread" },
    description: {
      ru: "Продажа одного call ниже и покупка двух call выше для сильного роста.",
      en: "Sell one lower call and buy two higher calls for a strong upside move.",
    },
    outlook: "bullish",
    legs: 3,
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
    id: "short-put",
    name: { ru: "Short Put", en: "Short Put" },
    description: {
      ru: "Продажа put около центрального страйка для бычьего или нейтрального сценария.",
      en: "Sell a put near the center strike for a bullish or neutral view.",
    },
    outlook: "bullish",
    legs: 1,
  },
  {
    id: "synthetic-short",
    name: { ru: "Synthetic Short", en: "Synthetic Short" },
    description: {
      ru: "Продажа call и покупка put на одном страйке для синтетической короткой позиции.",
      en: "Sell a call and buy a put at the same strike to create synthetic short exposure.",
    },
    outlook: "bearish",
    legs: 2,
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
    id: "put-ratio-backspread",
    name: { ru: "Put Ratio Backspread", en: "Put Ratio Backspread" },
    description: {
      ru: "Продажа одного put выше и покупка двух put ниже для сильного падения.",
      en: "Sell one higher put and buy two lower puts for a strong downside move.",
    },
    outlook: "bearish",
    legs: 3,
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
    id: "short-straddle",
    name: { ru: "Short Straddle", en: "Short Straddle" },
    description: {
      ru: "Продажа call и put на одном страйке в ожидании спокойного рынка.",
      en: "Sell a call and a put at the same strike when expecting a quiet market.",
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
    id: "short-strangle",
    name: { ru: "Short Strangle", en: "Short Strangle" },
    description: {
      ru: "Продажа OTM put и OTM call в ожидании движения внутри диапазона.",
      en: "Sell an OTM put and OTM call when expecting the underlying to stay in range.",
    },
    outlook: "neutral",
    legs: 2,
  },
  {
    id: "long-call-butterfly",
    name: { ru: "Long Call Butterfly", en: "Long Call Butterfly" },
    description: {
      ru: "Покупка call-крыльев и продажа двух центральных call для ограниченного диапазона.",
      en: "Buy call wings and sell two center calls for a defined range outcome.",
    },
    outlook: "neutral",
    legs: 4,
  },
  {
    id: "long-put-butterfly",
    name: { ru: "Long Put Butterfly", en: "Long Put Butterfly" },
    description: {
      ru: "Покупка put-крыльев и продажа двух центральных put для ограниченного диапазона.",
      en: "Buy put wings and sell two center puts for a defined range outcome.",
    },
    outlook: "neutral",
    legs: 4,
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
  {
    id: "iron-butterfly",
    name: { ru: "Iron Butterfly", en: "Iron Butterfly" },
    description: {
      ru: "Продажа центрального straddle с покупкой дальних защитных крыльев.",
      en: "Sell the center straddle and buy farther protective wings.",
    },
    outlook: "neutral",
    legs: 4,
  },
];

export const OPTIONS_STRATEGY_HELP: Record<Exclude<StrategyTemplateId, "custom">, StrategyHelp> = {
  "long-call": {
    thesis: {
      ru: "Ставка на рост базового актива через покупку права купить по фиксированному страйку.",
      en: "A bullish bet through the right to buy the underlying at a fixed strike.",
    },
    bestFor: {
      ru: "Ожидается рост и хочется ограничить риск уплаченной премией.",
      en: "Useful when upside is expected and risk should be limited to the paid premium.",
    },
    maxProfit: { ru: "Теоретически не ограничена.", en: "Theoretically unlimited." },
    maxLoss: { ru: "Уплаченная премия.", en: "The paid premium." },
    breakEven: { ru: "Страйк call плюс премия.", en: "Call strike plus premium." },
    note: {
      ru: "Страдает от временного распада, если движение не начинается быстро.",
      en: "Hurt by time decay if the move does not start quickly.",
    },
  },
  "short-call": {
    thesis: {
      ru: "Ставка на то, что актив не вырастет выше страйка проданного call.",
      en: "A bet that the underlying will not rise above the sold call strike.",
    },
    bestFor: {
      ru: "Нейтральный или умеренно медвежий сценарий с получением премии.",
      en: "Neutral to moderately bearish views where premium income is desired.",
    },
    maxProfit: { ru: "Полученная премия.", en: "The received premium." },
    maxLoss: { ru: "Теоретически не ограничен при сильном росте.", en: "Theoretically unlimited on a strong upside move." },
    breakEven: { ru: "Страйк call плюс полученная премия.", en: "Call strike plus received premium." },
    note: {
      ru: "Голая продажа call требует контроля риска и маржи.",
      en: "A naked short call requires strict risk and margin control.",
    },
  },
  "long-put": {
    thesis: {
      ru: "Ставка на падение базового актива через покупку права продать по фиксированному страйку.",
      en: "A bearish bet through the right to sell the underlying at a fixed strike.",
    },
    bestFor: {
      ru: "Ожидается снижение, а риск нужно ограничить премией.",
      en: "Useful when downside is expected and risk should be capped at the premium.",
    },
    maxProfit: { ru: "Ограничена падением актива к нулю.", en: "Limited by the underlying falling toward zero." },
    maxLoss: { ru: "Уплаченная премия.", en: "The paid premium." },
    breakEven: { ru: "Страйк put минус премия.", en: "Put strike minus premium." },
    note: {
      ru: "Может использоваться как направленная ставка или страховка позиции.",
      en: "Can be used as a directional trade or as portfolio protection.",
    },
  },
  "short-put": {
    thesis: {
      ru: "Ставка на то, что актив удержится выше страйка проданного put.",
      en: "A bet that the underlying will stay above the sold put strike.",
    },
    bestFor: {
      ru: "Умеренно бычий или нейтральный сценарий с получением премии.",
      en: "Moderately bullish to neutral views with premium income.",
    },
    maxProfit: { ru: "Полученная премия.", en: "The received premium." },
    maxLoss: { ru: "Большой, если актив падает к нулю.", en: "Large if the underlying falls toward zero." },
    breakEven: { ru: "Страйк put минус полученная премия.", en: "Put strike minus received premium." },
    note: {
      ru: "По риску похожа на готовность купить актив ниже текущей цены.",
      en: "Risk resembles being willing to buy the underlying below current price.",
    },
  },
  "synthetic-long": {
    thesis: {
      ru: "Позиция с профилем, близким к покупке базового актива: long call и short put.",
      en: "A position similar to owning the underlying: long call and short put.",
    },
    bestFor: {
      ru: "Сильный бычий взгляд, когда нужен почти линейный профиль через опционы.",
      en: "Strong bullish views where near-linear option exposure is desired.",
    },
    maxProfit: { ru: "Теоретически не ограничена.", en: "Theoretically unlimited." },
    maxLoss: { ru: "Большой, если актив падает к нулю.", en: "Large if the underlying falls toward zero." },
    breakEven: { ru: "Около общего страйка с поправкой на чистую премию.", en: "Near the shared strike adjusted by net premium." },
    note: {
      ru: "Маржинальная стратегия: short put несёт существенный риск.",
      en: "A margin strategy: the short put carries substantial risk.",
    },
  },
  "synthetic-short": {
    thesis: {
      ru: "Позиция с профилем, близким к шорту базового актива: short call и long put.",
      en: "A position similar to shorting the underlying: short call and long put.",
    },
    bestFor: {
      ru: "Сильный медвежий взгляд через опционы.",
      en: "Strong bearish views expressed through options.",
    },
    maxProfit: { ru: "Ограничена падением актива к нулю.", en: "Limited by the underlying falling toward zero." },
    maxLoss: { ru: "Теоретически не ограничен при сильном росте.", en: "Theoretically unlimited on a strong upside move." },
    breakEven: { ru: "Около общего страйка с поправкой на чистую премию.", en: "Near the shared strike adjusted by net premium." },
    note: {
      ru: "Short call делает стратегию рискованной при резком росте.",
      en: "The short call makes the strategy risky during a sharp rally.",
    },
  },
  "bull-call-spread": {
    thesis: {
      ru: "Умеренная ставка на рост с покупкой call и частичным финансированием через продажу call выше.",
      en: "A moderate bullish trade that buys a call and partly finances it by selling a higher call.",
    },
    bestFor: { ru: "Ожидается рост до ограниченной цели.", en: "Useful when upside is expected up to a limited target." },
    maxProfit: { ru: "Разница страйков минус чистый дебет.", en: "Strike width minus net debit." },
    maxLoss: { ru: "Чистый дебет.", en: "Net debit." },
    breakEven: { ru: "Нижний страйк плюс чистый дебет.", en: "Lower strike plus net debit." },
    note: { ru: "Дешевле long call, но прибыль сверху ограничена.", en: "Cheaper than a long call, but upside is capped." },
  },
  "bear-put-spread": {
    thesis: {
      ru: "Умеренная ставка на падение с покупкой put и продажей put ниже.",
      en: "A moderate bearish trade that buys a put and sells a lower put.",
    },
    bestFor: { ru: "Ожидается снижение до ограниченной цели.", en: "Useful when downside is expected up to a limited target." },
    maxProfit: { ru: "Разница страйков минус чистый дебет.", en: "Strike width minus net debit." },
    maxLoss: { ru: "Чистый дебет.", en: "Net debit." },
    breakEven: { ru: "Верхний страйк минус чистый дебет.", en: "Upper strike minus net debit." },
    note: { ru: "Дешевле long put, но прибыль снизу ограничена.", en: "Cheaper than a long put, but downside profit is capped." },
  },
  "bear-call-spread": {
    thesis: {
      ru: "Кредитная ставка на то, что актив не поднимется выше зоны проданного call.",
      en: "A credit trade betting the underlying stays below the sold call area.",
    },
    bestFor: { ru: "Нейтральный или умеренно медвежий рынок.", en: "Neutral to moderately bearish markets." },
    maxProfit: { ru: "Полученный чистый кредит.", en: "Net credit received." },
    maxLoss: { ru: "Разница страйков минус кредит.", en: "Strike width minus credit." },
    breakEven: { ru: "Страйк проданного call плюс кредит.", en: "Short call strike plus credit." },
    note: { ru: "Риск ограничен купленным call выше.", en: "Risk is capped by the higher long call." },
  },
  "bull-put-spread": {
    thesis: {
      ru: "Кредитная ставка на то, что актив удержится выше зоны проданного put.",
      en: "A credit trade betting the underlying stays above the sold put area.",
    },
    bestFor: { ru: "Нейтральный или умеренно бычий рынок.", en: "Neutral to moderately bullish markets." },
    maxProfit: { ru: "Полученный чистый кредит.", en: "Net credit received." },
    maxLoss: { ru: "Разница страйков минус кредит.", en: "Strike width minus credit." },
    breakEven: { ru: "Страйк проданного put минус кредит.", en: "Short put strike minus credit." },
    note: { ru: "Риск ограничен купленным put ниже.", en: "Risk is capped by the lower long put." },
  },
  "long-straddle": {
    thesis: {
      ru: "Покупка call и put на одном страйке: важна сила движения, а не направление.",
      en: "Buy a call and put at the same strike: magnitude matters more than direction.",
    },
    bestFor: { ru: "Ожидается резкий рост волатильности или сильный гэп.", en: "Useful before expected volatility expansion or a large gap." },
    maxProfit: { ru: "Сверху не ограничена, снизу ограничена падением актива к нулю.", en: "Unlimited upside; downside limited by the underlying going to zero." },
    maxLoss: { ru: "Сумма уплаченных премий.", en: "Total premium paid." },
    breakEven: { ru: "Страйк плюс/минус суммарная премия.", en: "Strike plus/minus total premium." },
    note: { ru: "Требует движения больше стоимости двух опционов.", en: "Requires a move larger than the cost of both options." },
  },
  "short-straddle": {
    thesis: {
      ru: "Продажа call и put на одном страйке: ставка на спокойствие около центра.",
      en: "Sell a call and put at the same strike: a bet on calm around the center.",
    },
    bestFor: { ru: "Ожидается боковик и снижение подразумеваемой волатильности.", en: "Useful when rangebound price action and falling implied volatility are expected." },
    maxProfit: { ru: "Суммарная полученная премия.", en: "Total premium received." },
    maxLoss: { ru: "Сверху не ограничен, снизу большой при падении к нулю.", en: "Unlimited upside risk; large downside risk toward zero." },
    breakEven: { ru: "Страйк плюс/минус суммарная премия.", en: "Strike plus/minus total premium." },
    note: { ru: "Одна из самых чувствительных стратегий к резкому движению.", en: "Highly sensitive to sharp price moves." },
  },
  "long-strangle": {
    thesis: {
      ru: "Покупка OTM put и OTM call: дешевле straddle, но нужно большее движение.",
      en: "Buy an OTM put and OTM call: cheaper than a straddle, but needs a larger move.",
    },
    bestFor: { ru: "Ожидается сильный выход из диапазона.", en: "Useful when a strong breakout from a range is expected." },
    maxProfit: { ru: "Сверху не ограничена, снизу ограничена падением актива к нулю.", en: "Unlimited upside; downside limited by the underlying going to zero." },
    maxLoss: { ru: "Сумма уплаченных премий.", en: "Total premium paid." },
    breakEven: { ru: "Нижний put-страйк минус премия и верхний call-страйк плюс премия.", en: "Lower put strike minus premium and upper call strike plus premium." },
    note: { ru: "Дешевле straddle, но зона убытка шире.", en: "Cheaper than a straddle, but the loss zone is wider." },
  },
  "short-strangle": {
    thesis: {
      ru: "Продажа OTM put и OTM call: ставка на удержание внутри диапазона.",
      en: "Sell an OTM put and OTM call: a bet on staying inside a range.",
    },
    bestFor: { ru: "Ожидается боковик без резкого роста волатильности.", en: "Useful when sideways action is expected without a volatility spike." },
    maxProfit: { ru: "Суммарная полученная премия.", en: "Total premium received." },
    maxLoss: { ru: "Сверху не ограничен, снизу большой при падении к нулю.", en: "Unlimited upside risk; large downside risk toward zero." },
    breakEven: { ru: "Нижний страйк минус кредит и верхний страйк плюс кредит.", en: "Lower strike minus credit and upper strike plus credit." },
    note: { ru: "Шире short straddle, но риск хвостовых движений остаётся.", en: "Wider than a short straddle, but tail risk remains." },
  },
  "long-call-butterfly": {
    thesis: {
      ru: "Дебетовая конструкция, которая выигрывает, если цена приходит к центральному call-страйку.",
      en: "A debit structure that benefits if price lands near the center call strike.",
    },
    bestFor: { ru: "Ожидается спокойный рынок около конкретного уровня.", en: "Useful when the underlying is expected to settle near a target level." },
    maxProfit: { ru: "Ширина крыла минус чистый дебет.", en: "Wing width minus net debit." },
    maxLoss: { ru: "Чистый дебет.", en: "Net debit." },
    breakEven: { ru: "Нижний страйк плюс дебет и верхний страйк минус дебет.", en: "Lower strike plus debit and upper strike minus debit." },
    note: { ru: "Требует достаточно близких и ликвидных страйков.", en: "Requires close and liquid strikes." },
  },
  "long-put-butterfly": {
    thesis: {
      ru: "Put-версия butterfly с ограниченным риском и целью около центрального страйка.",
      en: "The put version of a butterfly with defined risk and a target near the center strike.",
    },
    bestFor: { ru: "Ожидается закрепление около выбранного уровня.", en: "Useful when price is expected to pin near the selected level." },
    maxProfit: { ru: "Ширина крыла минус чистый дебет.", en: "Wing width minus net debit." },
    maxLoss: { ru: "Чистый дебет.", en: "Net debit." },
    breakEven: { ru: "Нижний страйк плюс дебет и верхний страйк минус дебет.", en: "Lower strike plus debit and upper strike minus debit." },
    note: { ru: "Профиль похож на call butterfly, но собирается через put.", en: "Similar profile to a call butterfly, assembled with puts." },
  },
  "iron-condor": {
    thesis: {
      ru: "Продажа внутреннего put/call диапазона с покупкой внешних защитных крыльев.",
      en: "Sell the inner put/call range and buy outer protective wings.",
    },
    bestFor: { ru: "Ожидается движение внутри широкого диапазона.", en: "Useful when the underlying is expected to stay inside a broad range." },
    maxProfit: { ru: "Полученный чистый кредит.", en: "Net credit received." },
    maxLoss: { ru: "Ширина крыла минус кредит.", en: "Wing width minus credit." },
    breakEven: { ru: "Нижний короткий страйк минус кредит и верхний короткий страйк плюс кредит.", en: "Lower short strike minus credit and upper short strike plus credit." },
    note: { ru: "Риск ограничен, но комиссия и спреды важны из-за четырёх ног.", en: "Risk is defined, but fees and spreads matter because there are four legs." },
  },
  "iron-butterfly": {
    thesis: {
      ru: "Кредитная butterfly: продажа центрального straddle и покупка дальних крыльев.",
      en: "A credit butterfly: sell the center straddle and buy farther wings.",
    },
    bestFor: { ru: "Ожидается закрепление около центрального страйка.", en: "Useful when price is expected to stay near the center strike." },
    maxProfit: { ru: "Полученный чистый кредит.", en: "Net credit received." },
    maxLoss: { ru: "Ширина крыла минус кредит.", en: "Wing width minus credit." },
    breakEven: { ru: "Центральный страйк плюс/минус чистый кредит.", en: "Center strike plus/minus net credit." },
    note: { ru: "Более узкая цель, чем iron condor, зато обычно выше кредит.", en: "Narrower target than an iron condor, but usually higher credit." },
  },
  "call-ratio-backspread": {
    thesis: {
      ru: "Продажа одного call ниже и покупка двух call выше: ставка на сильный рост.",
      en: "Sell one lower call and buy two higher calls: a bet on a strong upside move.",
    },
    bestFor: { ru: "Ожидается резкий рост, но не умеренный плавный подъём.", en: "Useful when a sharp rally is expected, not just a mild grind higher." },
    maxProfit: { ru: "Теоретически не ограничена.", en: "Theoretically unlimited." },
    maxLoss: { ru: "Обычно ограничен зоной около верхнего купленного страйка.", en: "Usually limited around the higher long strike area." },
    breakEven: { ru: "Зависит от расстояния страйков и чистой премии.", en: "Depends on strike width and net premium." },
    note: { ru: "Между страйками может быть неприятная зона убытка.", en: "There can be an uncomfortable loss zone between strikes." },
  },
  "put-ratio-backspread": {
    thesis: {
      ru: "Продажа одного put выше и покупка двух put ниже: ставка на сильное падение.",
      en: "Sell one higher put and buy two lower puts: a bet on a strong downside move.",
    },
    bestFor: { ru: "Ожидается резкое снижение или всплеск волатильности вниз.", en: "Useful when a sharp selloff or downside volatility expansion is expected." },
    maxProfit: { ru: "Большая, ограничена падением актива к нулю.", en: "Large, limited by the underlying falling toward zero." },
    maxLoss: { ru: "Обычно ограничен зоной около нижнего купленного страйка.", en: "Usually limited around the lower long strike area." },
    breakEven: { ru: "Зависит от расстояния страйков и чистой премии.", en: "Depends on strike width and net premium." },
    note: { ru: "Небольшое снижение может быть хуже сильного движения.", en: "A small decline can be worse than a large move." },
  },
};

export function getStrategyHelp(id: StrategyTemplateId): StrategyHelp | null {
  return id === "custom" ? null : OPTIONS_STRATEGY_HELP[id];
}

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

function buildShortCall(context: BuildContext): CandidateLeg[] | null {
  const entry = findNearestEntry(context.chain.calls, context.chain.referenceStrike);
  return entry ? [{ option: entry.option, action: "sell" }] : null;
}

function buildLongPut(context: BuildContext): CandidateLeg[] | null {
  const entry = findNearestEntry(context.chain.puts, context.chain.referenceStrike);
  return entry ? [{ option: entry.option, action: "buy" }] : null;
}

function buildShortPut(context: BuildContext): CandidateLeg[] | null {
  const entry = findNearestEntry(context.chain.puts, context.chain.referenceStrike);
  return entry ? [{ option: entry.option, action: "sell" }] : null;
}

function buildSameStrikeCallPut(context: BuildContext): { call: StrikeEntry; put: StrikeEntry } | null {
  const sharedStrike = findClosestStrike(context.chain.sharedStrikes, context.chain.referenceStrike);
  if (!Number.isFinite(sharedStrike ?? Number.NaN)) {
    return null;
  }

  const call = context.chain.calls.find((entry) => entry.strike === sharedStrike);
  const put = context.chain.puts.find((entry) => entry.strike === sharedStrike);
  return call && put ? { call, put } : null;
}

function buildSyntheticLong(context: BuildContext): CandidateLeg[] | null {
  const pair = buildSameStrikeCallPut(context);
  return pair
    ? [
        { option: pair.call.option, action: "buy" },
        { option: pair.put.option, action: "sell" },
      ]
    : null;
}

function buildSyntheticShort(context: BuildContext): CandidateLeg[] | null {
  const pair = buildSameStrikeCallPut(context);
  return pair
    ? [
        { option: pair.call.option, action: "sell" },
        { option: pair.put.option, action: "buy" },
      ]
    : null;
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
  const pair = buildSameStrikeCallPut(context);
  return pair
    ? [
        { option: pair.call.option, action: "buy" },
        { option: pair.put.option, action: "buy" },
      ]
    : null;
}

function buildShortStraddle(context: BuildContext): CandidateLeg[] | null {
  const pair = buildSameStrikeCallPut(context);
  return pair
    ? [
        { option: pair.call.option, action: "sell" },
        { option: pair.put.option, action: "sell" },
      ]
    : null;
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

function buildShortStrangle(context: BuildContext): CandidateLeg[] | null {
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
    { option: put.option, action: "sell" },
    { option: call.option, action: "sell" },
  ];
}

function buildLongCallButterfly(context: BuildContext): CandidateLeg[] | null {
  const middle = findNearestEntry(context.chain.calls, context.chain.referenceStrike);
  if (!middle) {
    return null;
  }

  const lower = findSiblingEntry(context.chain.calls, middle.strike, "lower");
  const higher = findSiblingEntry(context.chain.calls, middle.strike, "higher");
  if (!lower || !higher) {
    return null;
  }

  return [
    { option: lower.option, action: "buy" },
    { option: middle.option, action: "sell", quantity: 2 },
    { option: higher.option, action: "buy" },
  ];
}

function buildLongPutButterfly(context: BuildContext): CandidateLeg[] | null {
  const middle = findNearestEntry(context.chain.puts, context.chain.referenceStrike);
  if (!middle) {
    return null;
  }

  const lower = findSiblingEntry(context.chain.puts, middle.strike, "lower");
  const higher = findSiblingEntry(context.chain.puts, middle.strike, "higher");
  if (!lower || !higher) {
    return null;
  }

  return [
    { option: lower.option, action: "buy" },
    { option: middle.option, action: "sell", quantity: 2 },
    { option: higher.option, action: "buy" },
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

function buildIronButterfly(context: BuildContext): CandidateLeg[] | null {
  const pair = buildSameStrikeCallPut(context);
  if (!pair) {
    return null;
  }

  const longPut = findSiblingEntry(context.chain.puts, pair.put.strike, "lower");
  const longCall = findSiblingEntry(context.chain.calls, pair.call.strike, "higher");
  if (!longPut || !longCall) {
    return null;
  }

  return [
    { option: longPut.option, action: "buy" },
    { option: pair.put.option, action: "sell" },
    { option: pair.call.option, action: "sell" },
    { option: longCall.option, action: "buy" },
  ];
}

function buildCallRatioBackspread(context: BuildContext): CandidateLeg[] | null {
  const shortCall =
    findEntryAtOrBelow(context.chain.calls, context.chain.referenceStrike) ??
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
    { option: longCall.option, action: "buy", quantity: 2 },
  ];
}

function buildPutRatioBackspread(context: BuildContext): CandidateLeg[] | null {
  const shortPut =
    findEntryAtOrAbove(context.chain.puts, context.chain.referenceStrike) ??
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
    { option: longPut.option, action: "buy", quantity: 2 },
  ];
}

const STRATEGY_BUILDERS: Record<Exclude<StrategyTemplateId, "custom">, (context: BuildContext) => CandidateLeg[] | null> = {
  "long-call": buildLongCall,
  "short-call": buildShortCall,
  "long-put": buildLongPut,
  "short-put": buildShortPut,
  "synthetic-long": buildSyntheticLong,
  "synthetic-short": buildSyntheticShort,
  "bull-call-spread": buildBullCallSpread,
  "bear-put-spread": buildBearPutSpread,
  "bear-call-spread": buildBearCallSpread,
  "bull-put-spread": buildBullPutSpread,
  "long-straddle": buildLongStraddle,
  "short-straddle": buildShortStraddle,
  "long-strangle": buildLongStrangle,
  "short-strangle": buildShortStrangle,
  "long-call-butterfly": buildLongCallButterfly,
  "long-put-butterfly": buildLongPutButterfly,
  "iron-condor": buildIronCondor,
  "iron-butterfly": buildIronButterfly,
  "call-ratio-backspread": buildCallRatioBackspread,
  "put-ratio-backspread": buildPutRatioBackspread,
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

export function evaluateStrategyAtPrice(legs: StrategyLeg[], price: number): number {
  return evaluateStrategyPnl(legs, price);
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
  const templateLegCount = candidateLegs.reduce((sum, leg) => sum + (leg.quantity ?? 1), 0);

  return buildResultFromLegs({
    template: { ...template, legs: templateLegCount },
    expirationKey: params.expirationKey,
    referenceStrike: chain.referenceStrike,
    legs: candidateLegs.map((leg) => ({
      option: leg.option,
      action: leg.action,
      quantity: contracts * (leg.quantity ?? 1),
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
