import { Loader2, BarChart3, Clock, Award, Building2, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function PerformanceTab({ career, careerLoading }) {
  if (careerLoading) {
    return (
      <div className="text-center py-16 rounded-xl bg-card border border-border shadow-sm">
        <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-brand-500" aria-hidden="true" />
        <p className="text-sm text-muted-foreground font-medium">Loading performance data…</p>
      </div>
    );
  }

  if (!career) {
    return (
      <div className="text-center py-16 rounded-xl bg-card border border-border shadow-sm">
        <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" aria-hidden="true" />
        <p className="text-sm text-muted-foreground font-medium">No performance data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PerformanceStats career={career} />
      <RecordsTimeline records={career.recent_records} />
      {career.records_by_sport && Object.keys(career.records_by_sport).length > 0 && (
        <SportBreakdown recordsBySport={career.records_by_sport} />
      )}
      {career.records_by_source && Object.keys(career.records_by_source).length > 0 && (
        <SourceBreakdown recordsBySource={career.records_by_source} />
      )}
    </div>
  );
}

function PerformanceStats({ career }) {
  const organizationCount = career.organizations
    ? Array.isArray(career.organizations)
      ? career.organizations.length
      : career.organizations
    : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={BarChart3}
        value={career.total_records || 0}
        label="Total Records"
        color="text-brand-600 dark:text-brand-400"
        bgColor="bg-brand-50 dark:bg-brand-950"
        borderColor="border-brand-200 dark:border-brand-800"
      />
      <StatCard
        icon={Clock}
        value={career.training_hours || 0}
        label="Training Hours"
        color="text-brand-600 dark:text-brand-400"
        bgColor="bg-brand-50 dark:bg-brand-950"
        borderColor="border-brand-200 dark:border-brand-800"
      />
      <StatCard
        icon={Award}
        value={career.tournaments_played || 0}
        label="Tournaments"
        color="text-amber-600 dark:text-amber-400"
        bgColor="bg-amber-50 dark:bg-amber-950"
        borderColor="border-amber-200 dark:border-amber-800"
      />
      <StatCard
        icon={Building2}
        value={organizationCount}
        label="Organizations"
        color="text-brand-600 dark:text-brand-400"
        bgColor="bg-brand-50 dark:bg-brand-950"
        borderColor="border-brand-200 dark:border-brand-800"
      />
    </div>
  );
}

function StatCard({ icon: Icon, value, label, color, bgColor, borderColor }) {
  return (
    <div className={`text-center p-5 rounded-xl ${bgColor} border ${borderColor} hover:border-brand-400 dark:hover:border-brand-600 transition-colors`}>
      <Icon className={`h-6 w-6 mx-auto mb-2.5 ${color}`} aria-hidden="true" />
      <div className={`text-3xl font-display font-bold tabular-nums ${color}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mt-2">
        {label}
      </div>
    </div>
  );
}

function RecordsTimeline({ records }) {
  if (!records || records.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl shadow-sm p-6">
        <h3 className="font-display font-bold text-foreground mb-4 text-lg">Records Timeline</h3>
        <p className="text-sm text-muted-foreground text-center py-8">No records yet</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm p-6">
      <h3 className="font-display font-bold text-foreground mb-5 text-lg">Records Timeline</h3>
      <div className="space-y-3">
        {records.map((record, idx) => (
          <RecordCard key={record.id || idx} record={record} />
        ))}
      </div>
    </div>
  );
}

function RecordCard({ record }) {
  const typeColors = {
    training: "bg-brand-500/15 text-brand-600 dark:text-brand-400 border-brand-500/30",
    match_result: "bg-brand-500/15 text-brand-600 dark:text-brand-400 border-brand-500/30",
    assessment: "bg-brand-500/15 text-brand-600 dark:text-brand-400 border-brand-500/30",
    tournament_result: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    achievement: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
  };
  const badgeClass = typeColors[record.type] || "bg-secondary text-muted-foreground border-border";
  const statsObj = record.stats || record.data || {};
  const statEntries = Object.entries(statsObj).slice(0, 4);

  return (
    <div
      className="flex flex-col gap-3 p-4 rounded-lg bg-muted/30 border border-border hover:border-brand-400 dark:hover:border-brand-600 transition-colors"
      data-testid={`perf-record-${record.id || ""}`}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {record.date
              ? new Date(record.date).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "N/A"}
          </span>
          <Badge className={`text-[10px] border font-semibold uppercase tracking-wider ${badgeClass}`}>
            {(record.type || "unknown").replace("_", " ")}
          </Badge>
        </div>
        {record.sport && (
          <Badge variant="outline" className="text-[10px] font-semibold">
            {record.sport}
          </Badge>
        )}
      </div>
      <div className="font-semibold text-sm text-foreground">{record.title || record.type || "Untitled"}</div>
      {record.source_name && (
        <div className="text-xs text-muted-foreground">
          Source: <span className="text-foreground/80 font-medium">{record.source_name}</span>
        </div>
      )}
      {statEntries.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1">
          {statEntries.map(([key, value]) => (
            <span
              key={key}
              className="text-[11px] px-2.5 py-1 rounded-md bg-background border border-border font-medium"
            >
              <span className="text-muted-foreground">{key.replace(/_/g, " ")}:</span>{" "}
              <span className="text-foreground font-semibold">{String(value)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SportBreakdown({ recordsBySport }) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-sm p-6">
      <h3 className="font-display font-bold text-foreground mb-4 text-lg">Sport Breakdown</h3>
      <div className="flex flex-wrap gap-2.5">
        {Object.entries(recordsBySport).map(([sport, count]) => (
          <Badge
            key={sport}
            variant="secondary"
            className="text-xs px-4 py-2 font-mono bg-brand-100 dark:bg-brand-900 border border-brand-200 dark:border-brand-800"
          >
            {sport} <span className="ml-2 font-black text-brand-600 dark:text-brand-400">{count}</span>
          </Badge>
        ))}
      </div>
    </div>
  );
}

function SourceBreakdown({ recordsBySource }) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-sm p-6">
      <h3 className="font-display font-bold text-foreground mb-4 text-lg">Source Breakdown</h3>
      <div className="space-y-2">
        {Object.entries(recordsBySource).map(([source, count]) => (
          <div
            key={source}
            className="flex items-center justify-between py-3 border-b border-border last:border-0"
          >
            <span className="text-sm font-medium text-foreground">{source}</span>
            <span className="text-sm font-display font-bold text-muted-foreground tabular-nums">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
