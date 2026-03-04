import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { venueFinanceAPI, payoutAPI, venueAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { IndianRupee, TrendingUp, Calendar, Plus, Trash2, Clock, CheckCircle, Pencil, Filter, ArrowUpRight, ArrowDownRight, AlertCircle, Eye, Receipt, Wallet, Download, Banknote, Loader2, X, MessageSquare, Phone, Building } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

function StatCard({ icon: Icon, label, value, index = 0, colorClass = "text-brand-600", bgClass = "bg-brand-600/10" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="bg-card rounded-[28px] p-6 border border-border/40 shadow-sm flex flex-col justify-between transition-all duration-300"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="admin-label">{label}</div>
        <div className={`p-3 rounded-2xl ${bgClass} flex items-center justify-center border border-border/40`}>
          <Icon className={`h-5 w-5 ${colorClass}`} />
        </div>
      </div>
      <div className="admin-value">{value}</div>
    </motion.div>
  );
}

const VENUE_EXPENSE_CATEGORIES = ["maintenance", "staffing", "electricity", "water", "rent", "equipment", "marketing", "insurance", "cleaning", "other"];

export default function VenueFinancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // ─── Finance state ───
  const [financeSubTab, setFinanceSubTab] = useState(searchParams.get("subtab") || "overview");
  const [financeSummaryData, setFinanceSummaryData] = useState(null);
  const [venueExpenses, setVenueExpenses] = useState([]);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [editExpenseId, setEditExpenseId] = useState(null);
  const [expenseForm, setExpenseForm] = useState({ category: "maintenance", amount: "", date: new Date().toISOString().slice(0, 10), description: "", payment_mode: "cash", reference: "" });
  const [venueTransactions, setVenueTransactions] = useState([]);
  const [transactionFilters, setTransactionFilters] = useState({ date_from: "", date_to: "", type: "all" });
  const [venueInvoices, setVenueInvoices] = useState([]);
  const [invoiceMonth, setInvoiceMonth] = useState(new Date().toISOString().slice(0, 7));
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("all");
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ client_name: "", client_phone: "", client_email: "", date: new Date().toISOString().slice(0, 10), due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), status: "sent", payment_mode: "cash", gst_enabled: false, notes: "" });
  const [invoiceItems, setInvoiceItems] = useState([{ description: "", qty: "1", rate: "" }]);
  const [invoiceCreating, setInvoiceCreating] = useState(false);
  const [gstSettings, setGstSettings] = useState({ gst_enabled: false, gst_rate: 18, gstin: "", invoice_prefix: "VEN" });
  const [showGSTSettings, setShowGSTSettings] = useState(false);
  const [gstSaving, setGstSaving] = useState(false);

  // ─── Payout state ───
  const [payoutSummary, setPayoutSummary] = useState(null);
  const [myPayouts, setMyPayouts] = useState([]);
  const [linkedAccount, setLinkedAccount] = useState(null);
  const [bankForm, setBankForm] = useState({ account_number: "", ifsc_code: "", beneficiary_name: "", bank_name: "", business_type: "individual", phone: "", email: "" });
  const [bankSaving, setBankSaving] = useState(false);
  const [payoutDetailDialog, setPayoutDetailDialog] = useState(null);

  // ─── Venue filter state ───
  const [ownerVenues, setOwnerVenues] = useState([]);
  const [selectedVenueId, setSelectedVenueId] = useState(searchParams.get("venue") || "all");

  // Computed
  const invoiceSubtotal = invoiceItems.reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.rate) || 0), 0);
  const invoiceGstAmt = invoiceForm.gst_enabled ? Math.round(invoiceSubtotal * gstSettings.gst_rate / 100 * 100) / 100 : 0;
  const invoiceTotal = Math.round((invoiceSubtotal + invoiceGstAmt) * 100) / 100;

  // ─── Loaders ───
  const venueIdParam = selectedVenueId !== "all" ? selectedVenueId : undefined;

  const loadFinanceSummary = useCallback(async () => {
    try {
      const params = {};
      if (venueIdParam) params.venue_id = venueIdParam;
      const res = await venueFinanceAPI.financeSummary(params);
      setFinanceSummaryData(res.data);
    } catch { setFinanceSummaryData(null); }
  }, [venueIdParam]);
  const loadVenueExpenses = useCallback(async () => {
    try { const res = await venueFinanceAPI.listExpenses(); setVenueExpenses(res.data || []); } catch { setVenueExpenses([]); }
  }, []);
  const loadVenueTransactions = useCallback(async (filters = {}) => {
    try {
      const params = {};
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (filters.type && filters.type !== "all") params.type = filters.type;
      if (venueIdParam) params.venue_id = venueIdParam;
      const res = await venueFinanceAPI.listTransactions(params);
      setVenueTransactions(res.data || []);
    } catch { setVenueTransactions([]); }
  }, [venueIdParam]);
  const loadVenueInvoices = useCallback(async (params = {}) => {
    try { const res = await venueFinanceAPI.listInvoices(params); setVenueInvoices(res.data || []); } catch { setVenueInvoices([]); }
  }, []);
  const loadGstSettings = useCallback(async () => {
    try { const res = await venueFinanceAPI.getGstSettings(); setGstSettings(res.data || { gst_enabled: false, gst_rate: 18, gstin: "", invoice_prefix: "VEN" }); } catch {}
  }, []);
  const loadPayoutData = useCallback(async () => {
    try {
      const [summaryRes, payoutsRes, accountRes] = await Promise.allSettled([
        payoutAPI.mySummary(),
        payoutAPI.myPayouts(),
        payoutAPI.getLinkedAccount(),
      ]);
      if (summaryRes.status === "fulfilled") setPayoutSummary(summaryRes.value.data);
      if (payoutsRes.status === "fulfilled") { const pd = payoutsRes.value.data; setMyPayouts(Array.isArray(pd) ? pd : pd?.settlements || []); }
      if (accountRes.status === "fulfilled") { const ad = accountRes.value.data; setLinkedAccount(ad?.linked === false ? null : ad); }
    } catch {}
  }, []);

  // Load owner venues on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await venueAPI.getOwnerVenues();
        setOwnerVenues(res.data || []);
      } catch { setOwnerVenues([]); }
    })();
  }, []);

  // Load all data on mount & when selected venue changes
  useEffect(() => {
    loadFinanceSummary();
    loadVenueExpenses();
    loadVenueInvoices({ month: invoiceMonth });
    loadVenueTransactions();
    loadGstSettings();
    loadPayoutData();
  }, [loadFinanceSummary, loadVenueExpenses, loadVenueInvoices, loadVenueTransactions, loadGstSettings, loadPayoutData, invoiceMonth]);

  // Sync subtab + venue → URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (financeSubTab !== "overview") params.set("subtab", financeSubTab);
    if (selectedVenueId !== "all") params.set("venue", selectedVenueId);
    setSearchParams(params, { replace: true });
  }, [financeSubTab, selectedVenueId, setSearchParams]);

  // ─── Handlers ───
  const handleSaveExpense = async () => {
    try {
      if (editExpenseId) { await venueFinanceAPI.updateExpense(editExpenseId, expenseForm); toast.success("Expense updated"); }
      else { await venueFinanceAPI.createExpense(expenseForm); toast.success("Expense added"); }
      setAddExpenseOpen(false); setEditExpenseId(null);
      loadVenueExpenses(); loadFinanceSummary();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };
  const handleDeleteExpense = async (id) => {
    try { await venueFinanceAPI.deleteExpense(id); toast.success("Expense deleted"); loadVenueExpenses(); loadFinanceSummary(); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };
  const openEditExpense = (exp) => {
    setEditExpenseId(exp.id);
    setExpenseForm({ category: exp.category || "other", amount: String(exp.amount || ""), date: exp.date || "", description: exp.description || "", payment_mode: exp.payment_mode || "cash", reference: exp.reference || "" });
    setAddExpenseOpen(true);
  };
  const handleCreateInvoice = async () => {
    if (!invoiceForm.client_name) { toast.error("Client name is required"); return; }
    if (!invoiceItems.some(i => i.description && parseFloat(i.rate) > 0)) { toast.error("Add at least one item"); return; }
    setInvoiceCreating(true);
    try {
      await venueFinanceAPI.createInvoice({ ...invoiceForm, items: invoiceItems.filter(i => i.description), gst_rate: gstSettings.gst_rate });
      toast.success("Invoice created");
      setShowCreateInvoice(false);
      setInvoiceForm({ client_name: "", client_phone: "", client_email: "", date: new Date().toISOString().slice(0, 10), due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), status: "sent", payment_mode: "cash", gst_enabled: false, notes: "" });
      setInvoiceItems([{ description: "", qty: "1", rate: "" }]);
      loadVenueInvoices({ month: invoiceMonth });
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); } finally { setInvoiceCreating(false); }
  };
  const handleMarkInvoicePaid = async (id) => {
    try { await venueFinanceAPI.markInvoicePaid(id); toast.success("Marked as paid"); loadVenueInvoices({ month: invoiceMonth }); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };
  const handleDeleteInvoice = async (id) => {
    try { await venueFinanceAPI.deleteInvoice(id); toast.success("Invoice deleted"); loadVenueInvoices({ month: invoiceMonth }); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };
  const handleViewInvoicePdf = async (inv) => {
    try { const res = await venueFinanceAPI.getInvoicePdf(inv.id); const blob = new Blob([res.data], { type: "application/pdf" }); window.open(URL.createObjectURL(blob), "_blank"); }
    catch { toast.error("Failed to generate PDF"); }
  };
  const handleDownloadInvoicePdf = async (inv) => {
    try { const res = await venueFinanceAPI.getInvoicePdf(inv.id); const blob = new Blob([res.data], { type: "application/pdf" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `invoice-${inv.invoice_no}.pdf`; a.click(); }
    catch { toast.error("Failed to download PDF"); }
  };
  const handleSendInvoiceWhatsapp = async (inv) => {
    try { const res = await venueFinanceAPI.sendInvoiceWhatsapp(inv.id); if (res.data?.wa_link) window.open(res.data.wa_link, "_blank"); toast.success("Opening WhatsApp..."); }
    catch { toast.error("Failed"); }
  };
  const handleSaveGstSettings = async () => {
    setGstSaving(true);
    try { await venueFinanceAPI.saveGstSettings(gstSettings); toast.success("GST settings saved"); setShowGSTSettings(false); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed"); } finally { setGstSaving(false); }
  };

  return (
    <div className="space-y-6 pt-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-brand-600/10 border border-border/40">
            <IndianRupee className="h-6 w-6 text-brand-600" />
          </div>
          <div>
            <h1 className="admin-page-title">Finance</h1>
            <p className="text-sm text-muted-foreground">Revenue, expenses, invoices & payouts</p>
          </div>
        </div>
        {ownerVenues.length > 0 && (
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
              <SelectTrigger className="w-[220px] rounded-xl border-border/40 bg-card">
                <SelectValue placeholder="All Venues" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Venues</SelectItem>
                {ownerVenues.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* P&L Summary Cards */}
      {financeSummaryData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={IndianRupee} label="Total Revenue" value={`₹${(financeSummaryData.total_income || 0).toLocaleString()}`} colorClass="text-brand-600" bgClass="bg-brand-600/10" index={0} />
          <StatCard icon={TrendingUp} label="Net Profit" value={`₹${(financeSummaryData.net_profit || 0).toLocaleString()}`} colorClass={financeSummaryData.net_profit >= 0 ? "text-emerald-500" : "text-red-500"} bgClass={financeSummaryData.net_profit >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"} index={1} />
          <StatCard icon={Wallet} label="Expenses" value={`₹${(financeSummaryData.total_expenses || 0).toLocaleString()}`} colorClass="text-amber-500" bgClass="bg-amber-500/10" index={2} />
          <StatCard icon={Calendar} label="This Month" value={`₹${(financeSummaryData.current_month?.net || 0).toLocaleString()}`} colorClass="text-sky-500" bgClass="bg-sky-500/10" index={3} />
        </div>
      )}

      {/* Commission banner */}
      {financeSummaryData?.commission_pct > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-[28px] px-4 py-2 flex items-center gap-2 text-xs text-amber-500">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Platform commission: {financeSummaryData.commission_pct}% on booking revenue (₹{(financeSummaryData.commission_total || 0).toLocaleString()})
        </div>
      )}

      {/* Sub-tab switcher */}
      <div className="flex gap-2 w-full sm:w-auto overflow-x-auto flex-wrap">
        {[
          { id: "overview", label: "Overview" },
          { id: "transactions", label: "Ledger" },
          { id: "expenses", label: "Expenses" },
          { id: "invoices", label: `Invoices${venueInvoices.length ? ` (${venueInvoices.length})` : ""}` },
          { id: "payouts", label: "Payouts" },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => setFinanceSubTab(id)}
            className={`flex-shrink-0 transition-all ${
              financeSubTab === id
                ? "bg-brand-600 text-white shadow-md shadow-brand-600/20 rounded-full px-5 py-2 admin-btn"
                : "bg-card border border-border/40 text-muted-foreground rounded-full px-5 py-2 admin-btn hover:text-foreground"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* -- Overview sub-tab -- */}
      {financeSubTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Income by Sport */}
            <div className="bg-card rounded-[28px] border border-border/40 shadow-sm p-6 space-y-3">
              <p className="admin-section-label text-muted-foreground">Income by Sport</p>
              {Object.keys(financeSummaryData?.income_by_sport || {}).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(financeSummaryData.income_by_sport).map(([sport, amt]) => (
                    <div key={sport} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{sport}</span>
                      <span className="font-bold text-sky-400">₹{amt.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="border-t border-border pt-2 flex justify-between text-sm font-black">
                    <span>Total Revenue</span>
                    <span className="text-brand-600">₹{(financeSummaryData?.total_income || 0).toLocaleString()}</span>
                  </div>
                </div>
              ) : <p className="text-xs text-muted-foreground">No bookings yet</p>}
            </div>

            {/* Expense Breakdown */}
            <div className="bg-card rounded-[28px] border border-border/40 shadow-sm p-6 space-y-3">
              <p className="admin-section-label text-muted-foreground">Expense Breakdown</p>
              {Object.keys(financeSummaryData?.expenses_by_category || {}).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(financeSummaryData.expenses_by_category).map(([cat, amt]) => (
                    <div key={cat} className="flex justify-between text-sm">
                      <span className="text-muted-foreground capitalize">{cat.replace("_", " ")}</span>
                      <span className="font-bold text-amber-400">₹{amt.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="border-t border-border pt-2 flex justify-between text-sm font-black">
                    <span>Total</span>
                    <span className="text-destructive">₹{(financeSummaryData?.total_expenses || 0).toLocaleString()}</span>
                  </div>
                </div>
              ) : <p className="text-xs text-muted-foreground">No expenses recorded</p>}
            </div>
          </div>

          {/* Income by Venue (if multiple venues) */}
          {Object.keys(financeSummaryData?.income_by_venue || {}).length > 1 && (
            <div className="bg-card rounded-[28px] border border-border/40 shadow-sm p-6">
              <p className="admin-section-label text-muted-foreground mb-3">Income by Venue</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(financeSummaryData.income_by_venue).map(([vname, amt]) => (
                  <div key={vname} className="bg-card rounded-[28px] border border-border/40 shadow-sm p-3 text-center">
                    <p className="font-black text-sm text-foreground">₹{amt.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{vname}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly Trend Chart */}
          {(financeSummaryData?.monthly_trend || []).length > 0 && (
            <div className="bg-card rounded-[28px] border border-border/40 shadow-sm p-6">
              <p className="admin-section-label text-muted-foreground mb-4">6-Month Trend</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={financeSummaryData.monthly_trend} barSize={18} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 8, fontSize: 12 }}
                    formatter={(value, name) => [`₹${value.toLocaleString()}`, name === "income" ? "Income" : name === "expenses" ? "Expenses" : "Net"]} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#94A3B8" }} />
                  <Bar dataKey="income" name="Income" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="net" name="Net" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* -- Ledger sub-tab -- */}
      {financeSubTab === "transactions" && (
        <div className="space-y-4">
          <div className="bg-card rounded-[28px] border border-border/40 shadow-sm p-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wide admin-label">From</Label>
              <Input type="date" value={transactionFilters.date_from} onChange={e => setTransactionFilters(f => ({ ...f, date_from: e.target.value }))} className="mt-1 bg-secondary/20 border-border/40 rounded-xl text-xs h-8" />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wide admin-label">To</Label>
              <Input type="date" value={transactionFilters.date_to} onChange={e => setTransactionFilters(f => ({ ...f, date_to: e.target.value }))} className="mt-1 bg-secondary/20 border-border/40 rounded-xl text-xs h-8" />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wide admin-label">Type</Label>
              <Select value={transactionFilters.type} onValueChange={v => setTransactionFilters(f => ({ ...f, type: v }))}>
                <SelectTrigger className="mt-1 bg-secondary/20 border-border/40 rounded-xl text-xs h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button size="sm" className="w-full h-8 text-xs bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all" onClick={() => loadVenueTransactions(transactionFilters)}>
                <Filter className="h-3 w-3 mr-1" /> Apply
              </Button>
            </div>
          </div>

          {venueTransactions.length > 0 ? (
            <div className="space-y-2">
              {venueTransactions.map(txn => (
                <div key={txn.id} className="bg-card rounded-[28px] border border-border/40 shadow-sm p-4 flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${txn.type === "income" ? "bg-brand-600/10" : "bg-destructive/10"}`}>
                    {txn.type === "income" ? <ArrowUpRight className="h-4 w-4 text-brand-600" /> : <ArrowDownRight className="h-4 w-4 text-destructive" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="admin-name text-sm truncate">{txn.type === "income" ? (txn.client_name || txn.description) : txn.description || txn.category}</span>
                      <Badge className={`text-[10px] ${txn.type === "income" ? "bg-brand-600/10 text-brand-600" : "bg-destructive/10 text-destructive"}`}>{txn.type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground capitalize">{txn.date} · {txn.category?.replace("_", " ")}</p>
                  </div>
                  <span className={`font-black text-sm shrink-0 ${txn.type === "income" ? "text-brand-600" : "text-destructive"}`}>
                    {txn.type === "income" ? "+" : "-"}₹{(txn.amount || 0).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <Receipt className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No transactions found</p>
            </div>
          )}
        </div>
      )}

      {/* -- Expenses sub-tab -- */}
      {financeSubTab === "expenses" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{venueExpenses.length} expense{venueExpenses.length !== 1 ? "s" : ""} recorded</p>
            <Button size="sm" className="bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all text-xs h-8"
              onClick={() => { setEditExpenseId(null); setExpenseForm({ category: "maintenance", amount: "", date: new Date().toISOString().slice(0, 10), description: "", payment_mode: "cash", reference: "" }); setAddExpenseOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Expense
            </Button>
          </div>

          {venueExpenses.length > 0 ? (
            <div className="space-y-2">
              {venueExpenses.map(exp => (
                <div key={exp.id} className="bg-card rounded-[28px] border border-border/40 shadow-sm p-4 flex items-center gap-3">
                  <div className="bg-amber-500/10 h-8 w-8 rounded-full flex items-center justify-center shrink-0">
                    <ArrowDownRight className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="admin-name text-sm capitalize">{exp.category?.replace("_", " ")}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{exp.payment_mode?.replace("_", " ")}</Badge>
                      {exp.recurring && <Badge className="text-[10px] bg-violet-500/10 text-violet-400">Recurring</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{exp.date}{exp.description ? ` · ${exp.description}` : ""}</p>
                  </div>
                  <span className="font-black text-sm text-amber-400 shrink-0">₹{(exp.amount || 0).toLocaleString()}</span>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEditExpense(exp)} className="h-7 w-7 rounded-xl bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors">
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => handleDeleteExpense(exp.id)} className="h-7 w-7 rounded-xl bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center transition-colors">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <Receipt className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No expenses yet. Add your first expense.</p>
            </div>
          )}

          {/* Add/Edit Expense Dialog */}
          <Dialog open={addExpenseOpen} onOpenChange={(o) => { setAddExpenseOpen(o); if (!o) setEditExpenseId(null); }}>
            <DialogContent className="bg-card border-border max-w-[95vw] sm:max-w-md rounded-[28px]">
              <DialogHeader>
                <DialogTitle className="font-display admin-heading">{editExpenseId ? "Edit Expense" : "Add Expense"}</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground admin-label">Track your venue operating expenses</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground admin-label">Category</Label>
                    <Select value={expenseForm.category} onValueChange={v => setExpenseForm(f => ({ ...f, category: v }))}>
                      <SelectTrigger className="mt-1 bg-secondary/20 border-border/40 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {VENUE_EXPENSE_CATEGORIES.map(c => (
                          <SelectItem key={c} value={c} className="capitalize">{c.replace("_", " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground admin-label">Amount (₹) *</Label>
                    <Input type="number" value={expenseForm.amount} onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))} className="mt-1 h-11 bg-secondary/20 border-border/40 rounded-xl" placeholder="0" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground admin-label">Date</Label>
                    <Input type="date" value={expenseForm.date} onChange={e => setExpenseForm(f => ({ ...f, date: e.target.value }))} className="mt-1 h-11 bg-secondary/20 border-border/40 rounded-xl" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground admin-label">Payment Mode</Label>
                    <Select value={expenseForm.payment_mode} onValueChange={v => setExpenseForm(f => ({ ...f, payment_mode: v }))}>
                      <SelectTrigger className="mt-1 bg-secondary/20 border-border/40 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground admin-label">Description</Label>
                  <Input value={expenseForm.description} onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))} className="mt-1 h-11 bg-secondary/20 border-border/40 rounded-xl" placeholder="e.g. Monthly electricity bill" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground admin-label">Reference / Receipt No.</Label>
                  <Input value={expenseForm.reference} onChange={e => setExpenseForm(f => ({ ...f, reference: e.target.value }))} className="mt-1 h-11 bg-secondary/20 border-border/40 rounded-xl" placeholder="Optional" />
                </div>
                <Button className="w-full bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all" onClick={handleSaveExpense}>
                  {editExpenseId ? "Update Expense" : "Add Expense"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* -- Invoices sub-tab -- */}
      {financeSubTab === "invoices" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {["all", "sent", "paid", "draft"].map(s => (
                <button key={s} onClick={() => { setInvoiceStatusFilter(s); loadVenueInvoices({ month: invoiceMonth, status: s !== "all" ? s : undefined }); }}
                  className={`transition-all ${invoiceStatusFilter === s ? "bg-brand-600 text-white shadow-md shadow-brand-600/20 rounded-full px-5 py-2 admin-btn" : "bg-card border border-border/40 text-muted-foreground rounded-full px-5 py-2 admin-btn hover:text-foreground"}`}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
              <input type="month" value={invoiceMonth} onChange={e => { setInvoiceMonth(e.target.value); loadVenueInvoices({ month: e.target.value, status: invoiceStatusFilter !== "all" ? invoiceStatusFilter : undefined }); }}
                className="bg-secondary/20 border border-border/40 rounded-xl px-2 py-1 text-xs text-foreground" />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { loadGstSettings(); setShowGSTSettings(true); }}
                className="px-3 py-1.5 rounded-xl text-xs admin-btn border border-border bg-muted/40 hover:bg-muted text-muted-foreground transition-all flex items-center gap-1.5">
                GST Settings {gstSettings.gst_enabled && <span className="text-[10px] text-brand-600">ON</span>}
              </button>
              <Button size="sm" className="bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all text-xs h-8" onClick={() => setShowCreateInvoice(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Create Invoice
              </Button>
            </div>
          </div>

          {/* GST Settings Dialog */}
          <Dialog open={showGSTSettings} onOpenChange={setShowGSTSettings}>
            <DialogContent className="bg-card border-border max-w-[95vw] sm:max-w-sm rounded-[28px]">
              <DialogHeader>
                <DialogTitle className="font-display admin-heading">GST & Invoice Settings</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground admin-label">Configure GST for your venue invoices</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm admin-label">Enable GST</Label>
                    <p className="text-xs text-muted-foreground">Apply GST to all invoices by default</p>
                  </div>
                  <button onClick={() => setGstSettings(g => ({ ...g, gst_enabled: !g.gst_enabled }))}
                    className={`w-11 h-6 rounded-full transition-colors relative ${gstSettings.gst_enabled ? "bg-brand-600" : "bg-muted"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${gstSettings.gst_enabled ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
                {gstSettings.gst_enabled && (
                  <>
                    <div>
                      <Label className="text-xs text-muted-foreground">GSTIN</Label>
                      <Input value={gstSettings.gstin || ""} onChange={e => setGstSettings(g => ({ ...g, gstin: e.target.value.toUpperCase() }))} placeholder="29ABCDE1234F1Z5" className="mt-1 bg-secondary/20 border-border/40 rounded-xl font-mono text-xs" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">GST Rate</Label>
                      <div className="flex gap-2">
                        {[5, 12, 18].map(r => (
                          <button key={r} type="button" onClick={() => setGstSettings(g => ({ ...g, gst_rate: r }))}
                            className={`flex-1 transition-all ${gstSettings.gst_rate === r ? "bg-brand-600 text-white shadow-md shadow-brand-600/20 rounded-full px-5 py-2 admin-btn" : "bg-card border border-border/40 text-muted-foreground rounded-full px-5 py-2 admin-btn"}`}>
                            {r}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <Label className="text-xs text-muted-foreground">Invoice Prefix</Label>
                  <Input value={gstSettings.invoice_prefix || "VEN"} onChange={e => setGstSettings(g => ({ ...g, invoice_prefix: e.target.value.toUpperCase() }))} placeholder="VEN" className="mt-1 bg-secondary/20 border-border/40 rounded-xl w-28" />
                  <p className="text-[10px] text-muted-foreground mt-1">e.g. VEN → VEN-2026-0001</p>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all" onClick={handleSaveGstSettings} disabled={gstSaving}>
                    {gstSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                    Save Settings
                  </Button>
                  <Button variant="outline" onClick={() => setShowGSTSettings(false)}>Cancel</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Create Invoice Dialog */}
          <Dialog open={showCreateInvoice} onOpenChange={setShowCreateInvoice}>
            <DialogContent className="bg-card border-border max-w-[95vw] sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-[28px]">
              <DialogHeader>
                <DialogTitle className="font-display admin-heading">Create Invoice</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground admin-label">Create a manual invoice for your venue</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <Label className="text-xs text-muted-foreground admin-label">Client Name *</Label>
                    <Input value={invoiceForm.client_name} onChange={e => setInvoiceForm(f => ({ ...f, client_name: e.target.value }))} placeholder="Client name" className="mt-1 h-11 bg-secondary/20 border-border/40 rounded-xl" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground admin-label">Client Phone</Label>
                    <Input value={invoiceForm.client_phone} onChange={e => setInvoiceForm(f => ({ ...f, client_phone: e.target.value }))} placeholder="+91..." className="mt-1 h-11 bg-secondary/20 border-border/40 rounded-xl" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground admin-label">Invoice Date</Label>
                    <Input type="date" value={invoiceForm.date} onChange={e => setInvoiceForm(f => ({ ...f, date: e.target.value }))} className="mt-1 h-11 bg-secondary/20 border-border/40 rounded-xl" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground admin-label">Due Date</Label>
                    <Input type="date" value={invoiceForm.due_date} onChange={e => setInvoiceForm(f => ({ ...f, due_date: e.target.value }))} className="mt-1 h-11 bg-secondary/20 border-border/40 rounded-xl" />
                  </div>
                </div>

                {/* Line items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs text-muted-foreground">Items</Label>
                    <button type="button" onClick={() => setInvoiceItems(prev => [...prev, { description: "", qty: "1", rate: "" }])} className="text-xs admin-btn text-brand-600 flex items-center gap-1 hover:underline">
                      <Plus className="h-3 w-3" /> Add Row
                    </button>
                  </div>
                  <div className="rounded-[28px] border border-border overflow-hidden">
                    <div className="grid grid-cols-12 bg-muted/50 px-3 py-2 text-[10px] admin-section-label text-muted-foreground admin-th">
                      <span className="col-span-6">Description</span>
                      <span className="col-span-2 text-center">Qty</span>
                      <span className="col-span-2 text-right">Rate (₹)</span>
                      <span className="col-span-2 text-right">Amount</span>
                    </div>
                    {invoiceItems.map((item, i) => (
                      <div key={i} className="grid grid-cols-12 items-center px-2 py-1.5 border-t border-border gap-1">
                        <input value={item.description} onChange={e => setInvoiceItems(prev => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="e.g. Badminton court booking"
                          className="col-span-6 bg-secondary/20 border border-border/40 rounded-xl px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-600/50 min-w-0" />
                        <input type="number" value={item.qty} onChange={e => setInvoiceItems(prev => prev.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))}
                          className="col-span-2 bg-secondary/20 border border-border/40 rounded-xl px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-brand-600/50" />
                        <input type="number" value={item.rate} onChange={e => setInvoiceItems(prev => prev.map((x, j) => j === i ? { ...x, rate: e.target.value } : x))} placeholder="0"
                          className="col-span-2 bg-secondary/20 border border-border/40 rounded-xl px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-brand-600/50" />
                        <div className="col-span-1 text-right text-xs font-bold text-foreground">
                          {((parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </div>
                        {invoiceItems.length > 1 && (
                          <button type="button" onClick={() => setInvoiceItems(prev => prev.filter((_, j) => j !== i))}
                            className="col-span-1 h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* GST + payment mode + totals */}
                <div className="grid grid-cols-2 gap-4 items-start">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setInvoiceForm(f => ({ ...f, gst_enabled: !f.gst_enabled }))}
                        className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${invoiceForm.gst_enabled ? "bg-brand-600" : "bg-muted"}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${invoiceForm.gst_enabled ? "translate-x-4" : "translate-x-0"}`} />
                      </button>
                      <Label className="text-xs admin-label">Apply GST {gstSettings.gst_enabled ? `(${gstSettings.gst_rate}%)` : ""}</Label>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Payment Mode</Label>
                      <div className="flex gap-1.5 flex-wrap">
                        {["cash", "upi", "bank_transfer"].map(m => (
                          <button key={m} type="button" onClick={() => setInvoiceForm(f => ({ ...f, payment_mode: m }))}
                            className={`px-2.5 py-1 rounded-full text-xs admin-btn border transition-all ${invoiceForm.payment_mode === m ? "bg-brand-600/15 border-brand-600/40 text-brand-600" : "bg-secondary/30 border-border text-muted-foreground"}`}>
                            {m.replace("_", " ")}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="bg-secondary/30 rounded-xl p-4 space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>₹{invoiceSubtotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span></div>
                    {invoiceForm.gst_enabled && <div className="flex justify-between text-muted-foreground"><span>GST ({gstSettings.gst_rate}%)</span><span>₹{invoiceGstAmt.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span></div>}
                    <div className="flex justify-between font-black text-sm border-t border-border pt-1.5"><span>Total</span><span className="text-brand-600">₹{invoiceTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span></div>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground admin-label">Notes (optional)</Label>
                  <textarea value={invoiceForm.notes} onChange={e => setInvoiceForm(f => ({ ...f, notes: e.target.value }))} placeholder="Payment instructions, thank you note..."
                    className="mt-1 w-full bg-secondary/20 border border-border/40 rounded-xl px-3 py-2 text-sm min-h-[50px] resize-none focus:outline-none focus:ring-1 focus:ring-brand-600/50" />
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1 bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20 active:scale-[0.98] transition-all" onClick={handleCreateInvoice} disabled={invoiceCreating}>
                    {invoiceCreating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                    Create Invoice
                  </Button>
                  <Button variant="outline" className="admin-btn rounded-xl" onClick={() => setShowCreateInvoice(false)}>Cancel</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Invoice list */}
          {venueInvoices.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-[28px] border border-border/40 shadow-sm text-muted-foreground">
              <Receipt className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="admin-name mb-1">No Invoices Yet</p>
              <p className="text-sm">Create your first invoice or invoices will auto-generate on booking payments.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-3 mb-2">
                {[
                  { label: "Total", value: `₹${venueInvoices.reduce((s, i) => s + (i.total || 0), 0).toLocaleString()}`, color: "text-foreground" },
                  { label: "Collected", value: `₹${venueInvoices.filter(i => i.status === "paid").reduce((s, i) => s + (i.total || 0), 0).toLocaleString()}`, color: "text-brand-600" },
                  { label: "Pending", value: `₹${venueInvoices.filter(i => i.status !== "paid").reduce((s, i) => s + (i.total || 0), 0).toLocaleString()}`, color: "text-amber-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-card rounded-[28px] border border-border/40 shadow-sm p-3 text-center">
                    <p className={`font-black text-sm ${color}`}>{value}</p>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              {venueInvoices.map(inv => (
                <motion.div key={inv.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-[28px] border border-border/40 shadow-sm p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="admin-name text-sm">{inv.invoice_no}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${inv.status === "paid" ? "bg-brand-600/10 border-brand-600/20 text-brand-600" : inv.status === "sent" ? "bg-amber-500/10 border-amber-500/20 text-amber-500" : "bg-muted border-border text-muted-foreground"}`}>
                          {inv.status.toUpperCase()}
                        </span>
                        {inv.gst_enabled && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">GST</span>}
                        {inv.auto_generated && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">AUTO</span>}
                      </div>
                      <p className="text-sm font-medium">{inv.client_name}</p>
                      <p className="text-xs text-muted-foreground">{inv.date} · Due {inv.due_date}</p>
                      {inv.items?.length > 0 && <p className="text-xs text-muted-foreground mt-0.5 truncate">{inv.items.map(i => i.description).filter(Boolean).join(" · ")}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-base text-brand-600">₹{(inv.total || 0).toLocaleString()}</p>
                      {inv.gst_enabled && <p className="text-[10px] text-muted-foreground">incl. GST {inv.gst_rate}%</p>}
                    </div>
                  </div>
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    <button onClick={() => handleViewInvoicePdf(inv)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted/50 hover:bg-muted text-xs admin-btn text-muted-foreground hover:text-foreground transition-colors">
                      <Eye className="h-3 w-3" /> View PDF
                    </button>
                    <button onClick={() => handleDownloadInvoicePdf(inv)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted/50 hover:bg-muted text-xs admin-btn text-muted-foreground hover:text-foreground transition-colors">
                      <Download className="h-3 w-3" /> Download
                    </button>
                    <button onClick={() => handleSendInvoiceWhatsapp(inv)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-xs admin-btn text-green-600 transition-colors">
                      <MessageSquare className="h-3 w-3" /> WhatsApp
                    </button>
                    {inv.status !== "paid" && (
                      <button onClick={() => handleMarkInvoicePaid(inv.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-600/10 hover:bg-brand-600/20 text-xs admin-btn text-brand-600 transition-colors">
                        <CheckCircle className="h-3 w-3" /> Mark Paid
                      </button>
                    )}
                    {!inv.auto_generated && (
                      <button onClick={() => handleDeleteInvoice(inv.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-xs admin-btn text-destructive transition-colors ml-auto">
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* -- Payouts sub-tab -- */}
      {financeSubTab === "payouts" && (
        <div className="space-y-6">
          {/* Bank Account Section */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm admin-name text-foreground">Bank Account</p>
                <p className="text-xs text-muted-foreground mt-0.5">Link your bank account to receive venue payouts</p>
              </div>
              {linkedAccount && (
                <Badge className={`text-xs font-bold rounded-full px-3 ${linkedAccount.status === "active" ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-500"}`}>
                  {linkedAccount.status || "pending"}
                </Badge>
              )}
            </div>
            {linkedAccount ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Account</p>
                  <p className="font-semibold">{linkedAccount.bank_account?.account_number || "****"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">IFSC</p>
                  <p className="font-semibold">{linkedAccount.bank_account?.ifsc_code || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="font-semibold">{linkedAccount.bank_account?.beneficiary_name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Bank</p>
                  <p className="font-semibold">{linkedAccount.bank_account?.bank_name || "—"}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Account Number</Label>
                    <Input value={bankForm.account_number} onChange={e => setBankForm(p => ({ ...p, account_number: e.target.value }))} placeholder="Enter account number" className="mt-1 h-11 rounded-xl bg-secondary/20 border-border/40" />
                  </div>
                  <div>
                    <Label className="text-xs">IFSC Code</Label>
                    <Input value={bankForm.ifsc_code} onChange={e => setBankForm(p => ({ ...p, ifsc_code: e.target.value.toUpperCase() }))} placeholder="e.g. SBIN0001234" className="mt-1 h-11 rounded-xl bg-secondary/20 border-border/40" />
                  </div>
                  <div>
                    <Label className="text-xs">Beneficiary Name</Label>
                    <Input value={bankForm.beneficiary_name} onChange={e => setBankForm(p => ({ ...p, beneficiary_name: e.target.value }))} placeholder="Name as on bank account" className="mt-1 h-11 rounded-xl bg-secondary/20 border-border/40" />
                  </div>
                  <div>
                    <Label className="text-xs">Bank Name</Label>
                    <Input value={bankForm.bank_name} onChange={e => setBankForm(p => ({ ...p, bank_name: e.target.value }))} placeholder="e.g. State Bank of India" className="mt-1 h-11 rounded-xl bg-secondary/20 border-border/40" />
                  </div>
                  <div>
                    <Label className="text-xs">Phone</Label>
                    <Input value={bankForm.phone} onChange={e => setBankForm(p => ({ ...p, phone: e.target.value }))} placeholder="10-digit phone" className="mt-1 h-11 rounded-xl bg-secondary/20 border-border/40" />
                  </div>
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input value={bankForm.email} onChange={e => setBankForm(p => ({ ...p, email: e.target.value }))} placeholder="your@email.com" className="mt-1 h-11 rounded-xl bg-secondary/20 border-border/40" />
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={bankSaving || !bankForm.account_number || !bankForm.ifsc_code || !bankForm.beneficiary_name}
                  onClick={async () => {
                    setBankSaving(true);
                    try {
                      await payoutAPI.createLinkedAccount(bankForm);
                      toast.success("Bank account linked successfully");
                      loadPayoutData();
                    } catch (err) { toast.error(err?.response?.data?.detail || "Failed to link account"); }
                    finally { setBankSaving(false); }
                  }}
                  className="gap-2"
                >
                  {bankSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                  Link Bank Account
                </Button>
              </div>
            )}
          </div>

          {/* Payout Summary Cards */}
          {payoutSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard icon={IndianRupee} label="Total Earned" value={`₹${(payoutSummary.total_earned || 0).toLocaleString()}`} colorClass="text-brand-600" bgClass="bg-brand-600/10" index={0} />
              <StatCard icon={CheckCircle} label="Total Settled" value={`₹${(payoutSummary.total_settled || 0).toLocaleString()}`} colorClass="text-emerald-500" bgClass="bg-emerald-500/10" index={1} />
              <StatCard icon={Clock} label="Pending" value={`₹${(payoutSummary.pending_settlement || 0).toLocaleString()}`} colorClass="text-amber-500" bgClass="bg-amber-500/10" index={2} />
              <StatCard icon={Banknote} label="Last Payout" value={payoutSummary.last_payout_amount ? `₹${payoutSummary.last_payout_amount.toLocaleString()}` : "—"} colorClass="text-sky-500" bgClass="bg-sky-500/10" index={3} />
            </div>
          )}

          {/* Payout History */}
          <div className="space-y-3">
            <p className="admin-section-label text-muted-foreground">Payout History</p>
            {myPayouts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Banknote className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No payouts yet. Payouts are processed by the platform admin.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {myPayouts.map(p => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-xl border border-border p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => setPayoutDetailDialog(p)}
                  >
                    <div>
                      <p className="text-sm admin-name text-foreground">₹{(p.net_amount || 0).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.period_start} → {p.period_end}
                        {p.transfer_utr && <span className="ml-2 font-mono">UTR: {p.transfer_utr}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs font-bold rounded-full px-3 ${
                        p.status === "completed" ? "bg-green-500/10 text-green-600" :
                        p.status === "processing" ? "bg-blue-500/10 text-blue-600" :
                        p.status === "failed" ? "bg-red-500/10 text-red-600" :
                        "bg-secondary text-muted-foreground"
                      }`}>
                        {p.status}
                      </Badge>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Payout Detail Dialog */}
          {payoutDetailDialog && (
            <Dialog open={!!payoutDetailDialog} onOpenChange={() => setPayoutDetailDialog(null)}>
              <DialogContent className="bg-card border-border max-w-[95vw] sm:max-w-md rounded-[28px]">
                <DialogHeader>
                  <DialogTitle className="admin-heading">Payout Details</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">Period</p><p className="font-semibold">{payoutDetailDialog.period_start} → {payoutDetailDialog.period_end}</p></div>
                    <div><p className="text-xs text-muted-foreground">Status</p><p className="font-semibold capitalize">{payoutDetailDialog.status}</p></div>
                  </div>
                  <div className="bg-secondary/30 rounded-xl p-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Gross</span><span className="font-medium">₹{(payoutDetailDialog.gross_amount || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Commission ({payoutDetailDialog.commission_pct || 10}%)</span><span className="font-medium text-red-500">-₹{(payoutDetailDialog.commission_amount || 0).toLocaleString()}</span></div>
                    <div className="border-t border-border/40 pt-2 flex justify-between"><span className="admin-name">Net Payout</span><span className="font-black text-green-600">₹{(payoutDetailDialog.net_amount || 0).toLocaleString()}</span></div>
                  </div>
                  {payoutDetailDialog.razorpay_transfer_id && (
                    <p className="text-xs text-muted-foreground">Transfer: <span className="font-mono">{payoutDetailDialog.razorpay_transfer_id}</span></p>
                  )}
                  {payoutDetailDialog.transfer_utr && (
                    <p className="text-xs text-muted-foreground">UTR: <span className="font-mono">{payoutDetailDialog.transfer_utr}</span></p>
                  )}
                  {payoutDetailDialog.line_items?.length > 0 && (
                    <div>
                      <p className="admin-section-label text-muted-foreground mb-2">Items ({payoutDetailDialog.line_items.length})</p>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {payoutDetailDialog.line_items.map((item, i) => (
                          <div key={i} className="flex justify-between py-1.5 px-3 bg-secondary/20 rounded-xl text-xs">
                            <span>{item.description || item.type} <span className="text-muted-foreground">{item.date}</span></span>
                            <span className="font-semibold">₹{(item.net || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}
    </div>
  );
}
