import { BadgeCheck, Building2, Info, Layers, ShieldAlert } from "lucide-react";
import logoCompany from "../../../assets/logo_company.png";
import { useAppSettings } from "../../../app/context/AppSettingsContext";
import { PageHero, SectionCard } from "../../../shared/ui/analysis-shell";
import {
  ABOUT_APP_NAME,
  ABOUT_APP_VERSION,
  ABOUT_COMPANY_NAME,
  ABOUT_COMPANY_SLOGAN,
  ABOUT_COPYRIGHT_YEAR,
  ABOUT_MODULES,
} from "../model/about.consts";

export function AboutPage() {
  const { locale, t } = useAppSettings();
  const appName = ABOUT_APP_NAME[locale];

  const details = [
    { label: t({ ru: "Версия", en: "Version" }), value: ABOUT_APP_VERSION || "—" },
    { label: t({ ru: "Разработчик", en: "Developer" }), value: ABOUT_COMPANY_NAME },
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
            src={logoCompany}
            alt={`${ABOUT_COMPANY_NAME} — ${ABOUT_COMPANY_SLOGAN[locale]}`}
            className="h-56 w-56 shrink-0 rounded-2xl bg-white object-contain p-2 ring-1 ring-slate-200 dark:ring-white/10"
          />
          <div className="w-full space-y-4">
            <div>
              <div className="text-2xl font-semibold text-slate-950 dark:text-white">{appName}</div>
              <div className="mt-1 text-sm text-slate-500 dark:text-white/60">{ABOUT_COMPANY_SLOGAN[locale]}</div>
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
            <span>
              {t({
                ru: "Результаты анализа носят информационный характер и не являются индивидуальной инвестиционной рекомендацией.",
                en: "Analysis results are for informational purposes only and do not constitute individual investment advice.",
              })}
            </span>
          </p>
          <p className="pt-2 text-xs text-slate-500 dark:text-white/50">
            © {ABOUT_COPYRIGHT_YEAR} {ABOUT_COMPANY_NAME}. {t({ ru: "Все права защищены.", en: "All rights reserved." })}
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
