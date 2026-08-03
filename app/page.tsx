"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

const TAX_2026 = {
  schijf1: { limit: 38883, rate: 0.3575 },
  schijf2: { limit: 78426, rate: 0.3756 },
  schijf3: { rate: 0.495 },
  zelfstandigenaftrek: 1200,
  mkbVrijstelling: 0.127,
  urencriterium: 1225,
  btw: 0.21,
};

const STORAGE_KEY = "zzp-calculator-state-v1";

type Opdracht = {
  id: string;
  hourlyRate: number;
  hoursPerWeek: number;
};

type PersistedState = {
  opdrachten: Opdracht[];
  weeksPerYear: number;
  costsPerMonth: number;
  btwEnabled: boolean;
  viaIntermediair: boolean;
  intermediairPct: number;
  vakantieEnabled: boolean;
};

const DEFAULT_OPDRACHTEN: Opdracht[] = [
  { id: "1", hourlyRate: 95, hoursPerWeek: 32 },
];

const DEFAULT_STATE: PersistedState = {
  opdrachten: DEFAULT_OPDRACHTEN,
  weeksPerYear: 46,
  costsPerMonth: 250,
  btwEnabled: true,
  viaIntermediair: false,
  intermediairPct: 5,
  vakantieEnabled: true,
};

function sanitizeOpdrachten(value: unknown): Opdracht[] {
  if (!Array.isArray(value)) return DEFAULT_STATE.opdrachten;
  const cleaned: Opdracht[] = value
    .filter(
      (o): o is Record<string, unknown> => typeof o === "object" && o !== null
    )
    .map((o) => ({
      id: typeof o.id === "string" && o.id.length > 0 ? o.id : createOpdrachtId(),
      hourlyRate:
        typeof o.hourlyRate === "number" &&
        Number.isFinite(o.hourlyRate) &&
        o.hourlyRate >= 0
          ? o.hourlyRate
          : DEFAULT_OPDRACHTEN[0].hourlyRate,
      hoursPerWeek:
        typeof o.hoursPerWeek === "number" &&
        Number.isFinite(o.hoursPerWeek) &&
        o.hoursPerWeek >= 0
          ? o.hoursPerWeek
          : DEFAULT_OPDRACHTEN[0].hoursPerWeek,
    }));
  return cleaned.length > 0 ? cleaned : DEFAULT_STATE.opdrachten;
}

function loadPersistedState(): PersistedState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      opdrachten: sanitizeOpdrachten(parsed.opdrachten),
      weeksPerYear:
        typeof parsed.weeksPerYear === "number"
          ? parsed.weeksPerYear
          : DEFAULT_STATE.weeksPerYear,
      costsPerMonth:
        typeof parsed.costsPerMonth === "number"
          ? parsed.costsPerMonth
          : DEFAULT_STATE.costsPerMonth,
      btwEnabled:
        typeof parsed.btwEnabled === "boolean"
          ? parsed.btwEnabled
          : DEFAULT_STATE.btwEnabled,
      viaIntermediair:
        typeof parsed.viaIntermediair === "boolean"
          ? parsed.viaIntermediair
          : DEFAULT_STATE.viaIntermediair,
      intermediairPct:
        typeof parsed.intermediairPct === "number"
          ? parsed.intermediairPct
          : DEFAULT_STATE.intermediairPct,
      vakantieEnabled:
        typeof parsed.vakantieEnabled === "boolean"
          ? parsed.vakantieEnabled
          : DEFAULT_STATE.vakantieEnabled,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

const noopSubscribe = () => () => {};

// True once the client has hydrated, matching the server snapshot (false)
// during the initial hydration render so there is never a text mismatch.
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

function createOpdrachtId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function calcIB(belastbareWinst: number): number {
  if (belastbareWinst <= 0) return 0;
  const { schijf1, schijf2, schijf3 } = TAX_2026;
  if (belastbareWinst <= schijf1.limit) {
    return belastbareWinst * schijf1.rate;
  } else if (belastbareWinst <= schijf2.limit) {
    return (
      schijf1.limit * schijf1.rate +
      (belastbareWinst - schijf1.limit) * schijf2.rate
    );
  } else {
    return (
      schijf1.limit * schijf1.rate +
      (schijf2.limit - schijf1.limit) * schijf2.rate +
      (belastbareWinst - schijf2.limit) * schijf3.rate
    );
  }
}

type Theme = {
  bg: string;
  card: string;
  border: string;
  text: string;
  textMuted: string;
  textSoft: string;
  gold: string;
  goldSoft: string;
  goldBg: string;
};

export default function ZZPCalculator() {
  const hydrated = useHydrated();
  // Remount once hydration completes so the cached values (only readable on
  // the client) become the fresh initial state, without ever calling
  // setState from inside an effect.
  return <ZZPCalculatorInner key={hydrated ? "cached" : "default"} hydrated={hydrated} />;
}

function ZZPCalculatorInner({ hydrated }: { hydrated: boolean }) {
  const [initial] = useState<PersistedState>(() =>
    hydrated ? loadPersistedState() : DEFAULT_STATE
  );
  const [opdrachten, setOpdrachten] = useState<Opdracht[]>(
    initial.opdrachten
  );
  const [weeksPerYear, setWeeksPerYear] = useState(initial.weeksPerYear);
  const [costsPerMonth, setCostsPerMonth] = useState(initial.costsPerMonth);
  const [btwEnabled, setBtwEnabled] = useState(initial.btwEnabled);
  const [viaIntermediair, setViaIntermediair] = useState(
    initial.viaIntermediair
  );
  const [intermediairPct, setIntermediairPct] = useState(
    initial.intermediairPct
  );
  const [vakantieEnabled, setVakantieEnabled] = useState(
    initial.vakantieEnabled
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Cache the most recent values on this device.
  useEffect(() => {
    if (!hydrated) return;
    try {
      const toSave: PersistedState = {
        opdrachten,
        weeksPerYear,
        costsPerMonth,
        btwEnabled,
        viaIntermediair,
        intermediairPct,
        vakantieEnabled,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // Ignore storage failures (e.g. private browsing quota).
    }
  }, [
    hydrated,
    opdrachten,
    weeksPerYear,
    costsPerMonth,
    btwEnabled,
    viaIntermediair,
    intermediairPct,
    vakantieEnabled,
  ]);

  function addOpdracht() {
    setOpdrachten((prev) => [
      ...prev,
      { id: createOpdrachtId(), hourlyRate: 75, hoursPerWeek: 8 },
    ]);
  }

  function removeOpdracht(id: string) {
    setOpdrachten((prev) => prev.filter((o) => o.id !== id));
  }

  function updateOpdracht(id: string, patch: Partial<Opdracht>) {
    setOpdrachten((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...patch } : o))
    );
  }

  const calc = useMemo(() => {
    const effectiveWeeksPerYear = vakantieEnabled ? weeksPerYear : 52;
    const hoursPerWeekTotal = opdrachten.reduce(
      (sum, o) => sum + o.hoursPerWeek,
      0
    );
    const hoursYear = hoursPerWeekTotal * effectiveWeeksPerYear;
    const meetsUrencriterium = hoursYear >= TAX_2026.urencriterium;
    const grossPerWeek = opdrachten.reduce(
      (sum, o) => sum + o.hourlyRate * o.hoursPerWeek,
      0
    );
    const grossYear = grossPerWeek * effectiveWeeksPerYear;
    const blendedHourlyRate =
      hoursPerWeekTotal > 0 ? grossPerWeek / hoursPerWeekTotal : 0;
    const intermediairFee = viaIntermediair
      ? grossYear * (intermediairPct / 100)
      : 0;
    const revenueAfterIntermediair = grossYear - intermediairFee;
    const btwAmount = btwEnabled
      ? revenueAfterIntermediair * TAX_2026.btw
      : 0;
    const costsYear = costsPerMonth * 12;
    const fiscaleWinst = revenueAfterIntermediair - costsYear;
    const zelfstandigenaftrek = meetsUrencriterium
      ? TAX_2026.zelfstandigenaftrek
      : 0;
    const winstNaZA = Math.max(0, fiscaleWinst - zelfstandigenaftrek);
    const mkbVrijstelling = winstNaZA * TAX_2026.mkbVrijstelling;
    const belastbareWinst = winstNaZA - mkbVrijstelling;
    const ib = calcIB(belastbareWinst);
    const netYear = fiscaleWinst - ib;
    const netMonth = netYear / 12;
    const effectiveHourlyNet = hoursYear > 0 ? netYear / hoursYear : 0;
    const effectiveTaxRate = fiscaleWinst > 0 ? ib / fiscaleWinst : 0;

    return {
      effectiveWeeksPerYear,
      hoursPerWeekTotal,
      hoursYear,
      meetsUrencriterium,
      grossYear,
      blendedHourlyRate,
      intermediairFee,
      revenueAfterIntermediair,
      btwAmount,
      costsYear,
      fiscaleWinst,
      zelfstandigenaftrek,
      winstNaZA,
      mkbVrijstelling,
      belastbareWinst,
      ib,
      netYear,
      netMonth,
      effectiveHourlyNet,
      effectiveTaxRate,
    };
  }, [
    opdrachten,
    weeksPerYear,
    vakantieEnabled,
    costsPerMonth,
    btwEnabled,
    viaIntermediair,
    intermediairPct,
  ]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n);

  const fmtDec = (n: number) =>
    new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  const t: Theme = {
    bg: "#F8F6F0",
    card: "#FFFFFF",
    border: "#E8E5DC",
    text: "#1A1F2E",
    textMuted: "#5A6072",
    textSoft: "#8A8F9E",
    gold: "#EDB731",
    goldSoft: "#FAE9B8",
    goldBg: "#FFF6DB",
  };

  return (
    <div
      className="min-h-screen w-full"
      style={{
        fontFamily: "'Sora', system-ui, sans-serif",
        background: t.bg,
        color: t.text,
      }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-10 backdrop-blur-sm"
        style={{
          background: "rgba(248, 246, 240, 0.88)",
          borderBottom: `1px solid ${t.border}`,
        }}
      >
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
          <div
            className="text-lg md:text-xl font-bold tracking-tight"
            style={{ color: t.gold, fontWeight: 700 }}
          >
            Rocksolid Solutions
          </div>
          <div className="flex items-center gap-2">
            <CircleButton t={t}>
              <Diamond filled size={14} color={t.gold} />
            </CircleButton>
            <CircleButton t={t} active>
              <span style={{ fontSize: 15 }}>🧮</span>
            </CircleButton>
          </div>
        </div>

        {/* Mobile: keep monthly net income visible while scrolling */}
        <div
          className="lg:hidden max-w-6xl mx-auto px-5 md:px-8 pb-3 flex items-center justify-between"
          style={{ borderTop: `1px solid ${t.border}` }}
        >
          <span
            className="text-xs font-bold tracking-[0.2em] uppercase"
            style={{ color: t.gold }}
          >
            Netto / mnd
          </span>
          <span
            className="text-lg font-extrabold"
            style={{ color: t.text, fontWeight: 800 }}
          >
            {fmt(calc.netMonth)}
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 md:px-8 py-12 md:py-20">
        {/* Hero */}
        <div className="text-center mb-14 md:mb-20">
          <div
            className="text-xs md:text-sm font-bold tracking-[0.25em] uppercase mb-5"
            style={{ color: t.gold }}
          >
            ZZP Calculator — 2026
          </div>
          <h1
            className="text-5xl md:text-7xl font-extrabold leading-[1.05] tracking-tight"
            style={{ fontWeight: 800 }}
          >
            Wat hou je <span style={{ color: t.gold }}>écht</span> over
          </h1>
          <p
            className="text-base md:text-lg mt-6 max-w-xl mx-auto leading-relaxed"
            style={{ color: t.textMuted }}
          >
            Volledige berekening met kosten, BTW, en échte
            NL-belastingschijven — incl. zelfstandigenaftrek en
            MKB-winstvrijstelling.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
          {/* LEFT: INPUT */}
          <div className="space-y-5 md:space-y-6">
            {/* Opdrachten */}
            <Card t={t}>
              <CardHeader
                t={t}
                icon={<Diamond filled size={20} color={t.gold} />}
                title="Opdrachten"
                value={`${calc.hoursPerWeekTotal} u/week`}
                sub={`${calc.hoursYear} uur/jaar${
                  calc.meetsUrencriterium ? " · urencriterium gehaald ✓" : ""
                } · gem. € ${Math.round(calc.blendedHourlyRate)}/u`}
              />

              <div className="space-y-6">
                {opdrachten.map((opdracht, idx) => (
                  <div key={opdracht.id}>
                    {idx > 0 && (
                      <div
                        className="h-px mb-6"
                        style={{ background: t.border }}
                      />
                    )}
                    <div className="flex items-center justify-between mb-4">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: t.text }}
                      >
                        Opdracht {idx + 1}
                      </span>
                      {opdrachten.length > 1 && (
                        <RemoveButton
                          t={t}
                          onClick={() => removeOpdracht(opdracht.id)}
                          label={`Opdracht ${idx + 1} verwijderen`}
                        />
                      )}
                    </div>

                    <div className="mb-4">
                      <div className="flex items-baseline justify-between mb-2">
                        <label
                          className="text-xs font-semibold uppercase tracking-wide"
                          style={{ color: t.textMuted }}
                        >
                          Uurtarief
                        </label>
                        <span
                          className="text-sm font-bold"
                          style={{ color: t.gold }}
                        >
                          € {opdracht.hourlyRate}
                        </span>
                      </div>
                      <Slider
                        min={25}
                        max={200}
                        value={opdracht.hourlyRate}
                        onChange={(v) =>
                          updateOpdracht(opdracht.id, { hourlyRate: v })
                        }
                        t={t}
                      />
                      <NumberInput
                        value={opdracht.hourlyRate}
                        onChange={(v) =>
                          updateOpdracht(opdracht.id, { hourlyRate: v })
                        }
                        t={t}
                        suffix="per uur"
                      />
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between mb-2">
                        <label
                          className="text-xs font-semibold uppercase tracking-wide"
                          style={{ color: t.textMuted }}
                        >
                          Uren per week
                        </label>
                        <span
                          className="text-sm font-bold"
                          style={{ color: t.gold }}
                        >
                          {opdracht.hoursPerWeek} u
                        </span>
                      </div>
                      <Slider
                        min={1}
                        max={60}
                        value={opdracht.hoursPerWeek}
                        onChange={(v) =>
                          updateOpdracht(opdracht.id, { hoursPerWeek: v })
                        }
                        t={t}
                      />
                      <NumberInput
                        value={opdracht.hoursPerWeek}
                        onChange={(v) =>
                          updateOpdracht(opdracht.id, { hoursPerWeek: v })
                        }
                        t={t}
                        suffix="uur per week"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={addOpdracht}
                className="w-full mt-6 py-3 text-sm font-semibold rounded-full transition-all flex items-center justify-center gap-2"
                style={{
                  border: `1.5px dashed ${t.border}`,
                  background: "transparent",
                  color: t.gold,
                }}
              >
                + Opdracht toevoegen
              </button>
            </Card>

            {/* AFDRACHT GROEP */}
            <Card t={t}>
              <div className="mb-6">
                <Diamond filled size={20} color={t.gold} />
                <h3
                  className="text-xl md:text-2xl font-bold tracking-tight mt-4 mb-1"
                  style={{ fontWeight: 700 }}
                >
                  Afdracht
                </h3>
                <p className="text-sm" style={{ color: t.textMuted }}>
                  Kosten, BTW en inkomstenbelasting
                </p>
              </div>

              {/* Kosten */}
              <div className="mb-6">
                <div className="flex items-baseline justify-between mb-2">
                  <label
                    className="text-sm font-semibold"
                    style={{ color: t.text }}
                  >
                    Bedrijfskosten
                  </label>
                  <span
                    className="text-lg font-bold"
                    style={{ color: t.gold, fontWeight: 700 }}
                  >
                    € {costsPerMonth}/mnd
                  </span>
                </div>
                <p className="text-xs mb-3" style={{ color: t.textSoft }}>
                  Laptop, software, boekhouder, telefoon, etc.
                </p>
                <Slider
                  min={0}
                  max={2000}
                  value={costsPerMonth}
                  onChange={setCostsPerMonth}
                  t={t}
                />
                <NumberInput
                  value={costsPerMonth}
                  onChange={setCostsPerMonth}
                  t={t}
                  suffix="per maand"
                />
              </div>

              <div className="h-px my-5" style={{ background: t.border }} />

              {/* BTW */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div
                      className="text-sm font-semibold"
                      style={{ color: t.text }}
                    >
                      BTW (21%)
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: t.textSoft }}>
                      {btwEnabled
                        ? "Je factureert incl. BTW, draagt af per kwartaal"
                        : "Geen BTW (KOR of vrijgesteld)"}
                    </p>
                  </div>
                  <Toggle
                    checked={btwEnabled}
                    onChange={setBtwEnabled}
                    t={t}
                  />
                </div>
                {btwEnabled && (
                  <div
                    className="mt-3 p-3 rounded-xl text-sm flex items-center justify-between"
                    style={{ background: t.goldBg }}
                  >
                    <span style={{ color: t.textMuted }}>
                      Per jaar apart zetten
                    </span>
                    <span
                      className="font-bold"
                      style={{ color: t.text, fontWeight: 700 }}
                    >
                      {fmt(calc.btwAmount)}
                    </span>
                  </div>
                )}
              </div>

              <div className="h-px my-5" style={{ background: t.border }} />

              {/* IB */}
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <div>
                    <label
                      className="text-sm font-semibold"
                      style={{ color: t.text }}
                    >
                      Inkomstenbelasting
                    </label>
                    <p className="text-xs mt-0.5" style={{ color: t.textSoft }}>
                      Schijf 1–3 · incl. zelfstandigenaftrek + MKB
                    </p>
                  </div>
                  <span
                    className="text-lg font-bold"
                    style={{ color: t.gold, fontWeight: 700 }}
                  >
                    {(calc.effectiveTaxRate * 100).toFixed(1)}%
                  </span>
                </div>

                <div className="space-y-2 mt-4">
                  <MiniRow
                    t={t}
                    label="Fiscale winst"
                    value={fmt(calc.fiscaleWinst)}
                  />
                  <MiniRow
                    t={t}
                    label="− Zelfstandigenaftrek"
                    value={
                      calc.meetsUrencriterium
                        ? `− ${fmt(calc.zelfstandigenaftrek)}`
                        : "✗ niet van toepassing"
                    }
                  />
                  <MiniRow
                    t={t}
                    label="− MKB-vrijstelling (12,7%)"
                    value={`− ${fmt(calc.mkbVrijstelling)}`}
                  />
                  <MiniRow
                    t={t}
                    label="Belastbare winst"
                    value={fmt(calc.belastbareWinst)}
                    strong
                  />
                  <MiniRow
                    t={t}
                    label="Te betalen IB"
                    value={fmt(calc.ib)}
                    accent
                  />
                </div>
              </div>
            </Card>

            {/* INTERMEDIAIR TOGGLE */}
            <Card t={t}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="mb-2">
                    <Diamond
                      size={20}
                      color={viaIntermediair ? t.gold : t.textSoft}
                      filled={viaIntermediair}
                    />
                  </div>
                  <h3
                    className="text-xl md:text-2xl font-bold tracking-tight"
                    style={{ fontWeight: 700 }}
                  >
                    Via intermediair
                  </h3>
                  <p className="text-sm mt-1" style={{ color: t.textMuted }}>
                    Broker/bemiddelaar pakt % van je omzet
                  </p>
                </div>
                <Toggle
                  checked={viaIntermediair}
                  onChange={setViaIntermediair}
                  t={t}
                />
              </div>

              {viaIntermediair && (
                <div
                  className="mt-5 pt-5"
                  style={{ borderTop: `1px solid ${t.border}` }}
                >
                  <div className="flex items-baseline justify-between mb-3">
                    <label
                      className="text-sm font-semibold"
                      style={{ color: t.text }}
                    >
                      Fee percentage
                    </label>
                    <span
                      className="text-2xl font-extrabold"
                      style={{ color: t.gold, fontWeight: 800 }}
                    >
                      {intermediairPct}%
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={15}
                    value={intermediairPct}
                    onChange={setIntermediairPct}
                    t={t}
                  />
                  <div
                    className="mt-3 p-3 rounded-xl text-sm flex items-center justify-between"
                    style={{ background: t.goldBg }}
                  >
                    <span style={{ color: t.textMuted }}>Fee per jaar</span>
                    <span
                      className="font-bold"
                      style={{ color: t.text, fontWeight: 700 }}
                    >
                      − {fmt(calc.intermediairFee)}
                    </span>
                  </div>
                </div>
              )}
            </Card>

            {/* Advanced */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full py-3 text-sm font-semibold rounded-full transition-all flex items-center justify-center gap-2"
              style={{
                border: `1.5px solid ${t.border}`,
                background: "transparent",
                color: t.textMuted,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  transition: "transform 0.2s",
                  transform: showAdvanced ? "rotate(45deg)" : "rotate(0deg)",
                }}
              >
                +
              </span>
              Geavanceerd
            </button>

            {showAdvanced && (
              <Card t={t}>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div
                      className="text-sm font-semibold"
                      style={{ color: t.text }}
                    >
                      Vakantie & verzuim meenemen
                    </div>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: t.textSoft }}
                    >
                      Trekt vakantie-/ziekteweken af van je jaarlijkse uren
                    </p>
                  </div>
                  <Toggle
                    checked={vakantieEnabled}
                    onChange={setVakantieEnabled}
                    t={t}
                  />
                </div>

                {vakantieEnabled ? (
                  <>
                    <CardHeader
                      t={t}
                      icon={<Diamond size={20} color={t.gold} />}
                      title="Werkweken per jaar"
                      value={`${weeksPerYear}`}
                      sub="52 minus vakantie/ziek"
                    />
                    <Slider
                      min={30}
                      max={52}
                      value={weeksPerYear}
                      onChange={setWeeksPerYear}
                      t={t}
                    />
                    <NumberInput
                      value={weeksPerYear}
                      onChange={setWeeksPerYear}
                      t={t}
                      suffix="weken"
                    />
                  </>
                ) : (
                  <div
                    className="p-3 rounded-xl text-sm"
                    style={{ background: t.goldBg, color: t.textMuted }}
                  >
                    Berekening gaat uit van 52 werkweken per jaar — geen
                    vakantie- of ziekteaftrek.
                  </div>
                )}
              </Card>
            )}
          </div>

          {/* RIGHT: RESULTS */}
          <div className="space-y-5 md:space-y-6 lg:sticky lg:top-24 lg:self-start">
            {/* Hero result */}
            <div
              className="p-7 md:p-9 rounded-2xl relative overflow-hidden"
              style={{ background: t.text, color: t.bg }}
            >
              <div
                aria-hidden
                className="absolute -right-8 -top-8 opacity-10 pointer-events-none"
              >
                <Diamond filled size={140} color={t.gold} />
              </div>

              <div
                className="text-xs font-bold tracking-[0.25em] uppercase mb-3 relative"
                style={{ color: t.gold }}
              >
                Netto per maand
              </div>
              <div
                className="text-6xl md:text-7xl font-extrabold leading-none tracking-tight relative"
                style={{ fontWeight: 800 }}
              >
                {fmt(calc.netMonth)}
              </div>
              <div
                className="text-sm mt-4 flex items-center gap-2 flex-wrap relative"
                style={{ color: "rgba(248, 246, 240, 0.7)" }}
              >
                <span>{fmt(calc.netYear)} per jaar</span>
                <span>·</span>
                <span>{fmtDec(calc.effectiveHourlyNet)} netto p/u</span>
              </div>

              {viaIntermediair && (
                <div
                  className="mt-5 pt-5 text-xs relative"
                  style={{
                    borderTop: "1px solid rgba(248, 246, 240, 0.15)",
                    color: "rgba(248, 246, 240, 0.6)",
                  }}
                >
                  Scenario: via intermediair ({intermediairPct}%)
                </div>
              )}
            </div>

            {/* Breakdown */}
            <Card t={t}>
              <div
                className="text-xs font-bold tracking-[0.25em] uppercase mb-5"
                style={{ color: t.gold }}
              >
                Waterfall
              </div>
              <div className="space-y-4">
                <Row
                  t={t}
                  label="Bruto omzet"
                  sublabel="excl. BTW, per jaar"
                  value={fmt(calc.grossYear)}
                />

                {viaIntermediair && (
                  <Row
                    t={t}
                    label={`Intermediair (${intermediairPct}%)`}
                    sublabel="broker fee"
                    value={`− ${fmt(calc.intermediairFee)}`}
                    accent
                  />
                )}

                <Row
                  t={t}
                  label="Bedrijfskosten"
                  sublabel={`€ ${costsPerMonth}/mnd`}
                  value={`− ${fmt(calc.costsYear)}`}
                  accent
                />

                <div className="h-px" style={{ background: t.border }} />

                <Row
                  t={t}
                  label="Fiscale winst"
                  sublabel="voor IB"
                  value={fmt(calc.fiscaleWinst)}
                />

                <Row
                  t={t}
                  label="Inkomstenbelasting"
                  sublabel={`effectief ${(calc.effectiveTaxRate * 100).toFixed(1)}%`}
                  value={`− ${fmt(calc.ib)}`}
                  accent
                />

                <div className="h-px" style={{ background: t.border }} />

                <Row
                  t={t}
                  label="Netto per jaar"
                  sublabel="wat je écht overhoudt"
                  value={fmt(calc.netYear)}
                  strong
                />
              </div>

              {/* Distribution bar */}
              <div className="mt-7">
                <div
                  className="text-xs font-bold tracking-[0.2em] uppercase mb-3"
                  style={{ color: t.textMuted }}
                >
                  Verdeling
                </div>
                <DistributionBar
                  segments={[
                    {
                      value: Math.max(0, calc.netYear),
                      color: t.text,
                      label: "Netto",
                    },
                    {
                      value: calc.ib,
                      color: t.gold,
                      label: "IB",
                    },
                    {
                      value: calc.costsYear,
                      color: "#B8651C",
                      label: "Kosten",
                    },
                    ...(viaIntermediair
                      ? [
                          {
                            value: calc.intermediairFee,
                            color: "#5A6072",
                            label: "Intermediair",
                          },
                        ]
                      : []),
                  ]}
                  t={t}
                />
              </div>

              {btwEnabled && (
                <div
                  className="mt-5 p-3 rounded-xl text-xs"
                  style={{ background: t.goldBg, color: t.textMuted }}
                >
                  <strong style={{ color: t.text }}>BTW-reminder:</strong>{" "}
                  je factureert {fmt(calc.btwAmount)} BTW bovenop je tarief —
                  apart zetten, niet vergeten af te dragen.
                </div>
              )}
            </Card>

            <p
              className="text-xs leading-relaxed text-center"
              style={{ color: t.textSoft }}
            >
              Indicatief, op basis van tarieven 2026. Exclusief algemene
              heffingskorting, arbeidskorting, startersaftrek en box
              3-vermogen. Voor de echte aanslag: bel je accountant.
            </p>
          </div>
        </div>
      </main>

      <footer className="mt-10" style={{ borderTop: `1px solid ${t.border}` }}>
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-6 flex items-center justify-between">
          <span className="text-sm font-bold" style={{ color: t.gold }}>
            Rocksolid Solutions
          </span>
          <span className="text-xs" style={{ color: t.textSoft }}>
            Built for freelancers
          </span>
        </div>
      </footer>

      <style>{`
        .rs-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          background: ${t.border};
          border-radius: 999px;
          outline: none;
        }
        .rs-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          background: ${t.gold};
          cursor: pointer;
          border-radius: 50%;
          border: 3px solid ${t.card};
          box-shadow: 0 2px 8px rgba(26, 31, 46, 0.15);
          transition: transform 0.15s ease;
        }
        .rs-slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }
        .rs-slider::-moz-range-thumb {
          width: 22px;
          height: 22px;
          background: ${t.gold};
          cursor: pointer;
          border-radius: 50%;
          border: 3px solid ${t.card};
          box-shadow: 0 2px 8px rgba(26, 31, 46, 0.15);
        }
        .rs-numinput {
          width: 100%;
          padding: 12px 16px;
          background: ${t.bg};
          border: 1.5px solid ${t.border};
          border-radius: 12px;
          font-family: 'Sora', sans-serif;
          font-size: 15px;
          font-weight: 500;
          color: ${t.text};
          outline: none;
          transition: border-color 0.15s ease;
        }
        .rs-numinput:focus {
          border-color: ${t.gold};
        }
        .rs-numinput::-webkit-outer-spin-button,
        .rs-numinput::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>
    </div>
  );
}

// --- Subcomponents ---

function Diamond({
  filled,
  size = 20,
  color = "#EDB731",
}: {
  filled?: boolean;
  size?: number;
  color?: string;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        background: filled ? color : "transparent",
        border: filled ? "none" : `2.5px solid ${color}`,
        transform: "rotate(45deg)",
        borderRadius: 2,
        display: "inline-block",
      }}
    />
  );
}

function CircleButton({
  children,
  t,
  active,
}: {
  children: ReactNode;
  t: Theme;
  active?: boolean;
}) {
  return (
    <button
      className="w-10 h-10 rounded-full flex items-center justify-center transition-all"
      style={{
        background: active ? t.gold : t.card,
        border: `1px solid ${active ? t.gold : t.border}`,
      }}
    >
      {children}
    </button>
  );
}

function RemoveButton({
  t,
  onClick,
  label,
}: {
  t: Theme;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
      style={{
        border: `1.5px solid ${t.border}`,
        background: "transparent",
        color: t.textSoft,
        fontSize: 14,
        lineHeight: 1,
      }}
    >
      ×
    </button>
  );
}

function Card({ children, t }: { children: ReactNode; t: Theme }) {
  return (
    <div
      className="p-6 md:p-7 rounded-2xl"
      style={{
        background: t.card,
        border: `1px solid ${t.border}`,
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({
  icon,
  title,
  value,
  sub,
  t,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  sub?: string;
  t: Theme;
}) {
  return (
    <div className="mb-5">
      <div className="mb-4">{icon}</div>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h3
          className="text-xl md:text-2xl font-bold tracking-tight"
          style={{ color: t.text, fontWeight: 700 }}
        >
          {title}
        </h3>
        <span
          className="text-2xl md:text-3xl font-extrabold tracking-tight"
          style={{ color: t.gold, fontWeight: 800 }}
        >
          {value}
        </span>
      </div>
      {sub && (
        <p className="text-sm" style={{ color: t.textMuted }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function Slider({
  min,
  max,
  value,
  onChange,
}: {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  t: Theme;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step="1"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rs-slider mb-4"
    />
  );
}

function NumberInput({
  value,
  onChange,
  t,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  t: Theme;
  suffix?: string;
}) {
  // Free-typed text while editing, so clearing the field to type a fresh
  // number (e.g. "80") doesn't get coerced to 0 mid-keystroke, which used
  // to insert a leading zero ("08", then "080", ...).
  const [text, setText] = useState(String(value));
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setText(String(value));
  }

  function commit(raw: string) {
    const parsed = Math.max(0, Number(raw) || 0);
    onChange(parsed);
    setText(String(parsed));
  }

  return (
    <div className="flex items-center gap-3">
      <input
        type="number"
        min={0}
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          const parsed = Number(raw);
          if (raw !== "" && Number.isFinite(parsed) && parsed >= 0) {
            onChange(parsed);
          }
        }}
        onBlur={(e) => commit(e.target.value)}
        className="rs-numinput"
        style={{ maxWidth: 140 }}
      />
      {suffix && (
        <span className="text-sm" style={{ color: t.textMuted }}>
          {suffix}
        </span>
      )}
    </div>
  );
}

function Row({
  label,
  sublabel,
  value,
  accent,
  strong,
  t,
}: {
  label: string;
  sublabel?: string;
  value: string;
  accent?: boolean;
  strong?: boolean;
  t: Theme;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <div
          className="text-sm md:text-base"
          style={{
            color: strong ? t.text : t.textMuted,
            fontWeight: strong ? 600 : 500,
          }}
        >
          {label}
        </div>
        <div className="text-xs" style={{ color: t.textSoft }}>
          {sublabel}
        </div>
      </div>
      <div
        className={strong ? "text-xl md:text-2xl" : "text-base md:text-lg"}
        style={{
          fontWeight: strong ? 800 : 600,
          color: accent ? t.gold : t.text,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function MiniRow({
  label,
  value,
  strong,
  accent,
  t,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
  t: Theme;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span
        className="text-sm"
        style={{
          color: strong ? t.text : t.textMuted,
          fontWeight: strong ? 600 : 400,
        }}
      >
        {label}
      </span>
      <span
        className="text-sm"
        style={{
          fontWeight: strong || accent ? 700 : 500,
          color: accent ? t.gold : t.text,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  t,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  t: Theme;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative rounded-full transition-all"
      style={{
        width: 48,
        height: 28,
        background: checked ? t.gold : t.border,
      }}
    >
      <span
        className="absolute top-1 rounded-full transition-all"
        style={{
          width: 20,
          height: 20,
          background: "#FFFFFF",
          left: checked ? 24 : 4,
          boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
        }}
      />
    </button>
  );
}

function DistributionBar({
  segments,
  t,
}: {
  segments: Array<{ value: number; color: string; label: string }>;
  t: Theme;
}) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  if (total === 0) return null;

  return (
    <div>
      <div
        className="w-full h-3 flex overflow-hidden rounded-full"
        style={{ background: t.border }}
      >
        {segments.map((seg, i) => {
          const pct = (Math.max(0, seg.value) / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={i}
              style={{
                width: `${pct}%`,
                background: seg.color,
                transition: "width 0.2s ease",
              }}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-xs">
        {segments.map((seg, i) => {
          const pct = total > 0 ? (Math.max(0, seg.value) / total) * 100 : 0;
          return (
            <div key={i} className="flex items-center gap-1.5">
              <div
                style={{
                  width: 8,
                  height: 8,
                  background: seg.color,
                  borderRadius: 2,
                }}
              />
              <span className="font-semibold" style={{ color: t.text }}>
                {seg.label}
              </span>
              <span style={{ color: t.textSoft }}>{pct.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
