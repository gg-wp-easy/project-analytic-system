import type { FundamentalMetricKey } from "../../../format/fundamentals";
import type { FundamentalMetricTooltipText } from "./fundamental-metric-tooltips.types";

export const FUNDAMENTAL_METRIC_TOOLTIPS: Record<FundamentalMetricKey, FundamentalMetricTooltipText> = {
  marketCapBn: {
    ru: "Рыночная капитализация: текущая цена акции, умноженная на число акций в обращении. Показывает, во сколько рынок оценивает всю компанию.",
    en: "Market capitalization is the current share price multiplied by the number of outstanding shares. It shows how the market values the whole company.",
  },
  peRatio: {
    ru: "P/E: цена акции, делённая на прибыль на акцию за последние 12 месяцев. Показывает, сколько рынок платит за единицу прибыли.",
    en: "P/E is the current share price divided by earnings per share over the last 12 months. It shows how much the market pays for one unit of earnings.",
  },
  pbRatio: {
    ru: "P/B: отношение рыночной цены акции к балансовой стоимости капитала на акцию. Помогает сравнить рыночную оценку компании с её чистыми активами.",
    en: "P/B compares the market price of a share with book value per share. It helps compare market valuation with the company's net assets.",
  },
  psRatio: {
    ru: "P/S: цена акции, делённая на выручку на акцию за последние 12 месяцев. Часто полезен, когда прибыль нестабильна, но продажи уже есть.",
    en: "P/S is the current share price divided by revenue per share over the last 12 months. It can be useful when profits are unstable but revenue is already meaningful.",
  },
  evToEbitda: {
    ru: "EV/EBITDA: стоимость компании с учётом долга относительно EBITDA. Часто используют для сравнения бизнесов с разной долговой и налоговой структурой.",
    en: "EV/EBITDA compares enterprise value, including debt, with EBITDA. It is often used to compare businesses with different debt and tax structures.",
  },
  roe: {
    ru: "ROE: чистая прибыль к собственному капиталу. Показывает, насколько эффективно компания зарабатывает на деньгах акционеров.",
    en: "ROE is net income divided by shareholders' equity. It shows how efficiently the company earns on shareholder capital.",
  },
  roa: {
    ru: "ROA: чистая прибыль к средним активам. Показывает, насколько эффективно бизнес использует свои активы для получения прибыли.",
    en: "ROA is net income divided by average total assets. It shows how efficiently the business uses its assets to generate profit.",
  },
  netMargin: {
    ru: "Чистая маржа: доля выручки, которая остаётся в виде чистой прибыли после всех расходов. Чем выше показатель, тем больше прибыли компания удерживает с каждого рубля продаж.",
    en: "Net margin is the share of revenue left as net profit after all expenses. A higher value means the company keeps more profit from each unit of sales.",
  },
  netDebtToEbitda: {
    ru: "Чистый долг / EBITDA: отношение чистого долга к EBITDA. Это краткая оценка долговой нагрузки: грубо показывает, сколько EBITDA нужно, чтобы покрыть чистый долг.",
    en: "Net debt / EBITDA compares net debt with EBITDA. It is a quick leverage measure that roughly shows how many EBITDA units are needed to cover net debt.",
  },
  totalDebt: {
    ru: "Общий долг: сумма задолженности компании перед кредиторами. Обычно его оценивают вместе с денежными средствами и способностью бизнеса обслуживать долг.",
    en: "Total debt is the company's total amount owed to creditors. It is usually assessed together with cash reserves and the business's ability to service debt.",
  },
  dividendYield: {
    ru: "Дивидендная доходность: годовые дивиденды на акцию, делённые на текущую цену акции. Показывает доход от дивидендов в процентах к цене бумаги.",
    en: "Dividend yield is annual dividends per share divided by the current share price. It shows dividend income as a percentage of the stock price.",
  },
  beta: {
    ru: "Бета показывает, как акция обычно движется относительно рынка. Значение выше 1 часто означает более сильные движения, ниже 1 — более спокойные.",
    en: "Beta shows how a stock tends to move relative to the market. A beta above 1 often means larger moves, while below 1 often means milder moves.",
  },
};
