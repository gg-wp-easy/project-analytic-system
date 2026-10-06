import { BadgeCheck, Boxes, Building2, Info, Layers, ShieldAlert } from "lucide-react";
import logoLight from "../../../assets/brand/nk-tech-finance-logo.png";
import logoDark from "../../../assets/brand/nk-tech-finance-logo-dark.png";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { NK_PRODUCTS } from "../../../shared/config/app-info";
import { PageHero, SectionCard } from "../../../shared/ui/analysis-shell";
import {
  ABOUT_APP_DESCRIPTION,
  ABOUT_APP_NAME,
  ABOUT_APP_VERSION,
  ABOUT_BRAND,
  ABOUT_COMPANY_SLOGAN,
  ABOUT_COPYRIGHT,
  ABOUT_DEVELOPER,
  ABOUT_DISCLAIMER,
  ABOUT_EMAIL,
  ABOUT_MODULES,
} from "../model/about.consts";

export function AboutPage() {
  const { locale, t } = useAppSettings();
  const appName = ABOUT_APP_NAME[locale];

  const details = [
    { label: t({ ru: "Версия", en: "Version" }), value: ABOUT_APP_VERSION || "—" },
    { label: t({ ru: "Разработчик", en: "Developer" }), value: t(ABOUT_DEVELOPER) },
    { label: t({ ru: "Связь", en: "Contact" }), value: ABOUT_EMAIL },
    { label: t({ ru: "Модель распространения", en: "Distribution model" }), value: t({ ru: "По подписке", en: "Subscription" }) },
  ];

  return (
    <div className="space-y-6">
      <PageHero
        icon={Info}
        title={t({ ru: "О программе", en: "About" })}
        description={t({
          ru: "Информация о приложении, версии и правообладателе.",
          en: "Application, version and copyright holder information.",
        })}
        accent="slate"
      />

      <SectionCard>
        <div className="flex flex-col items-center gap-8 md:flex-row md:items-center">
          <img
            src={logoLight}
            alt={`${ABOUT_BRAND} — ${ABOUT_COMPANY_SLOGAN[locale]}`}
            className="h-56 w-56 shrink-0 object-contain dark:hidden"
          />
          <img
            src={logoDark}
            alt={`${ABOUT_BRAND} — ${ABOUT_COMPANY_SLOGAN[locale]}`}
            className="hidden h-56 w-56 shrink-0 object-contain dark:block"
          />
          <div className="w-full space-y-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{ABOUT_BRAND}</div>
              <div className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{appName}</div>
              <div className="mt-1 text-sm text-slate-500 dark:text-white/60">{t(ABOUT_APP_DESCRIPTION)}</div>
            </div>
            <dl className="divide-y divide-slate-200 dark:divide-white/10">
              {details.map((item) => (
                <div key={item.label} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                  <dt className="text-slate-500 dark:text-white/60">{item.label}</dt>
                  <dd className="text-right font-medium text-slate-900 dark:text-white">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title={
          <span className="inline-flex items-center gap-2">
            <Layers className="h-5 w-5" />
            {t({ ru: "Возможности", en: "Features" })}
          </span>
        }
        description={t({
          ru: "Аналитическая система для работы с инвестиционными данными.",
          en: "Analytics system for working with investment data.",
        })}
      >
        <ul className="space-y-2 text-sm text-slate-700 dark:text-white/80">
          {ABOUT_MODULES.map((module) => (
            <li key={module.ru} className="flex items-start gap-2">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{t(module)}</span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        title={
          <span className="inline-flex items-center gap-2">
            <Boxes className="h-5 w-5" />
            {t({ ru: `Продукты ${ABOUT_BRAND}`, en: `${ABOUT_BRAND} products` })}
          </span>
        }
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {NK_PRODUCTS.map((product) => (
            <li
              key={product.id}
              aria-current={product.id === "analytics" ? "true" : undefined}
              className={`flex items-start gap-3 rounded-xl border p-3 ${
                product.id === "analytics" ? "border-primary bg-primary/10" : "border-slate-200 dark:border-white/10"
              }`}
            >
              <img src={product.icon} alt="" className="h-10 w-10 shrink-0 rounded-lg" />
              <div className="min-w-0 text-sm">
                <div className="font-semibold text-slate-900 dark:text-white">{t(product.name)}</div>
                <div className="text-slate-500 dark:text-white/60">{t(product.description)}</div>
                <div className="text-xs text-slate-400 dark:text-white/45">{t(product.platforms)}</div>
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        title={
          <span className="inline-flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {t({ ru: "Лицензия и подписка", en: "License and subscription" })}
          </span>
        }
      >
        <div className="space-y-3 text-sm leading-6 text-slate-700 dark:text-white/80">
          <p>
            {t({
              ru: "Программа распространяется по подписке. Условия использования и срок действия подписки определяются соглашением с правообладателем.",
              en: "The software is distributed by subscription. Terms of use and the subscription period are defined by the agreement with the copyright holder.",
            })}
          </p>
          <p className="flex items-start gap-2 text-slate-500 dark:text-white/60">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t(ABOUT_DISCLAIMER)}</span>
          </p>
          <p className="pt-2 text-xs text-slate-500 dark:text-white/50">
            {ABOUT_COPYRIGHT} · {ABOUT_COMPANY_SLOGAN[locale]}. {t({ ru: "Все права защищены.", en: "All rights reserved." })}
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
