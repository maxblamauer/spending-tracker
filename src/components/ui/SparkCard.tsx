import stevieTrendPositive from '../../assets/stevie-logo-mark-lg.png';
import stevieTrendNegative from '../../assets/stevie-logo-mark-trend-negative.png';

interface SparkCardProps {
  label: string;
  value: string;
  change?: number;
  subtitle?: string;
  invertColor?: boolean;
  valueColor?: string;
  changeTooltip?: string;
}

export function SparkCard({
  label,
  value,
  change,
  subtitle,
  invertColor,
  valueColor,
  changeTooltip,
}: SparkCardProps) {
  const changeIsGood = invertColor ? (change ?? 0) < 0 : (change ?? 0) > 0;
  const changeColor = change !== undefined
    ? (changeIsGood ? 'var(--green)' : 'var(--red)')
    : undefined;

  const pctLabel =
    change !== undefined
      ? changeIsGood
        ? `${Math.abs(change).toFixed(1)}%`
        : `-${Math.abs(change).toFixed(1)}%`
      : '';

  const pctBlock =
    change !== undefined ? (
      <div className="spark-card-change-pct" style={{ color: changeColor }}>
        {changeTooltip ? (
          <span className="has-tooltip">
            <span>{pctLabel}</span>
            <span className="tooltip">{changeTooltip}</span>
          </span>
        ) : (
          <span>{pctLabel}</span>
        )}
      </div>
    ) : null;

  const trendImage =
    change !== undefined ? (
      <div
        className={`spark-card-trend-side ${changeIsGood ? 'spark-card-trend-side--good' : 'spark-card-trend-side--bad'}`}
      >
        <img
          src={changeIsGood ? stevieTrendPositive : stevieTrendNegative}
          alt=""
          className="spark-card-trend-mark"
          aria-hidden
        />
      </div>
    ) : null;

  return (
    <div className="spark-card">
      <div className="spark-card-label">{label}</div>
      {change !== undefined ? (
        <div className="spark-card-main-row">
          <div className="spark-card-main-left">
            <div className="spark-card-value" style={valueColor ? { color: valueColor } : undefined}>
              {value}
            </div>
            {pctBlock}
            {subtitle && <div className="spark-card-subtitle">{subtitle}</div>}
          </div>
          {trendImage}
        </div>
      ) : (
        <>
          <div className="spark-card-value" style={valueColor ? { color: valueColor } : undefined}>
            {value}
          </div>
          {subtitle && <div className="spark-card-subtitle">{subtitle}</div>}
        </>
      )}
    </div>
  );
}
