import type { ToolkitResult } from "../api";

interface MetricRailProps {
  result: ToolkitResult;
  latencyMs: number;
}

const number = new Intl.NumberFormat();

/** "0.000517" -> "$0.00052" — enough precision to be meaningful at this scale. */
function money(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  if (amount === 0) return "$0";
  return `$${amount.toFixed(5)}`;
}

function cheapest(costs: Record<string, string>): [string, string] | null {
  const entries = Object.entries(costs);
  if (!entries.length) return null;
  return entries.reduce((low, entry) =>
    Number(entry[1]) < Number(low[1]) ? entry : low,
  );
}

export default function MetricRail({ result, latencyMs }: MetricRailProps) {
  const { usage, equivalent_cost_usd: equivalents } = result;
  const low = cheapest(equivalents);

  return (
    <div className="rail">
      <dl className="rail__grid">
        <div className="metric">
          <dt className="metric__label">Input</dt>
          <dd className="metric__value">
            {number.format(usage.input_tokens)}
            <span className="metric__unit">tok</span>
          </dd>
        </div>

        <div className="metric">
          <dt className="metric__label">Output</dt>
          <dd className="metric__value">
            {number.format(usage.output_tokens)}
            <span className="metric__unit">tok</span>
          </dd>
        </div>

        <div className="metric">
          <dt className="metric__label">Latency</dt>
          <dd className="metric__value">
            {(latencyMs / 1000).toFixed(2)}
            <span className="metric__unit">s</span>
          </dd>
        </div>

        <div className="metric metric--accent">
          <dt className="metric__label">Hosted equivalent</dt>
          <dd className="metric__value">{low ? money(low[1]) : "—"}</dd>
        </div>
      </dl>

      <p className="rail__note">
        Actual spend {money(result.cost_usd)} — this ran on{" "}
        <span className="rail__model">{result.model}</span> via{" "}
        <span className="rail__model">{result.provider}</span>.
        {low ? (
          <>
            {" "}
            The same token counts would cost{" "}
            {Object.entries(equivalents).map(([name, value], index) => (
              <span key={name}>
                {index > 0 ? ", " : ""}
                {money(value)} on <span className="rail__model">{name}</span>
              </span>
            ))}
            .
          </>
        ) : null}
      </p>
    </div>
  );
}
