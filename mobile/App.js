import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, Modal,
  ScrollView, ActivityIndicator, RefreshControl, Alert,
  Linking, StatusBar, SafeAreaView,
} from "react-native";
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchIdeas, fetchExecutions, createExecution, forceRun, pushToGithub } from "./src/api/client";

const qc = new QueryClient();

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:       "#080c14",
  surface:  "#0f1623",
  border:   "#1e2d3d",
  text:     "#e2e8f0",
  muted:    "#64748b",
  indigo:   "#6366f1",
  emerald:  "#10b981",
  amber:    "#f59e0b",
  rose:     "#f43f5e",
  blue:     "#3b82f6",
  purple:   "#a855f7",
};

const COMPLEXITY = {
  simple:  { color: C.emerald, label: "Simple"  },
  medium:  { color: C.amber,   label: "Medium"   },
  complex: { color: C.rose,    label: "Complex"  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function Badge({ label, color }) {
  return (
    <View style={[s.badge, { borderColor: color + "60", backgroundColor: color + "18" }]}>
      <View style={[s.badgeDot, { backgroundColor: color }]} />
      <Text style={[s.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: { color: C.muted,   label: "Pending"  },
    running: { color: C.blue,    label: "Running"  },
    done:    { color: C.emerald, label: "Done"     },
    error:   { color: C.rose,    label: "Error"    },
    pushed:  { color: C.purple,  label: "On GitHub"},
  };
  const { color, label } = map[status] || map.pending;
  return (
    <View style={[s.badge, { borderColor: color + "60", backgroundColor: color + "18" }]}>
      <Text style={[s.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ── Idea Card ─────────────────────────────────────────────────────────────────

function IdeaCard({ idea, execution, onPress }) {
  const cx = COMPLEXITY[idea.complexity] || COMPLEXITY.medium;
  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
      onPress={() => onPress(idea, execution)}
    >
      <View style={s.cardTop}>
        <Badge label={cx.label} color={cx.color} />
        <Text style={s.cardCategory}>{idea.category}</Text>
        {execution && <StatusBadge status={execution.status} />}
      </View>
      <Text style={s.cardName}>{idea.name}</Text>
      <Text style={s.cardTagline} numberOfLines={2}>{idea.tagline}</Text>
      <Text style={s.cardDesc} numberOfLines={3}>{idea.description}</Text>
      <View style={s.cardMeta}>
        <Text style={s.metaItem}>⏱ {idea.timeToMVP}</Text>
        <Text style={s.metaItem}>💰 {idea.estimatedRevenueModel}</Text>
        <Text style={s.metaItem}>⚡ {idea.easeOfMonetization}/10</Text>
      </View>
    </Pressable>
  );
}

// ── Idea Detail Modal ──────────────────────────────────────────────────────────

function IdeaModal({ idea, execution, visible, onClose }) {
  const qclient = useQueryClient();
  const cx = COMPLEXITY[idea?.complexity] || COMPLEXITY.medium;

  const executeMutation = useMutation({
    mutationFn: () => createExecution(idea),
    onSuccess: () => {
      qclient.invalidateQueries(["executions"]);
      onClose();
    },
    onError: (e) => Alert.alert("Error", e.message),
  });

  const pushMutation = useMutation({
    mutationFn: () => pushToGithub(execution?.id),
    onSuccess: (data) => {
      qclient.invalidateQueries(["executions"]);
      if (data.github_url) Linking.openURL(data.github_url);
    },
    onError: (e) => Alert.alert("Error", e.message),
  });

  if (!idea) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[s.flex, { backgroundColor: C.bg }]}>
        <View style={s.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.modalTitle} numberOfLines={2}>{idea.name}</Text>
            <Text style={s.modalTagline}>{idea.tagline}</Text>
          </View>
          <Pressable onPress={onClose} style={s.closeBtn}>
            <Text style={{ color: C.muted, fontSize: 18 }}>✕</Text>
          </Pressable>
        </View>

        <ScrollView style={s.flex} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
            <Badge label={cx.label} color={cx.color} />
            <Badge label={idea.category} color={C.indigo} />
            {execution && <StatusBadge status={execution.status} />}
          </View>

          <Text style={s.sectionLabel}>Description</Text>
          <Text style={s.sectionBody}>{idea.description}</Text>

          <Text style={s.sectionLabel}>Key Features</Text>
          {(idea.keyFeatures || []).map((f, i) => (
            <Text key={i} style={s.listItem}>· {f}</Text>
          ))}

          <Text style={s.sectionLabel}>Tech Stack</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {(idea.techStack || []).map((t) => (
              <View key={t} style={s.techPill}>
                <Text style={s.techText}>{t}</Text>
              </View>
            ))}
          </View>

          <Text style={s.sectionLabel}>Monetization</Text>
          <Text style={s.sectionBody}>{idea.monetizationStrategy}</Text>

          <View style={s.metaGrid}>
            <View style={s.metaCell}><Text style={s.metaCellLabel}>Time to MVP</Text><Text style={s.metaCellVal}>{idea.timeToMVP}</Text></View>
            <View style={s.metaCell}><Text style={s.metaCellLabel}>Revenue Model</Text><Text style={s.metaCellVal}>{idea.estimatedRevenueModel}</Text></View>
            <View style={s.metaCell}><Text style={s.metaCellLabel}>Ease</Text><Text style={s.metaCellVal}>{idea.easeOfMonetization}/10</Text></View>
          </View>
        </ScrollView>

        <View style={s.modalFooter}>
          {!execution ? (
            <Pressable
              style={[s.primaryBtn, executeMutation.isPending && { opacity: 0.6 }]}
              onPress={() => executeMutation.mutate()}
              disabled={executeMutation.isPending}
            >
              {executeMutation.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.primaryBtnText}>▶ Execute Idea</Text>
              }
            </Pressable>
          ) : execution.status === "done" ? (
            <Pressable
              style={[s.primaryBtn, { backgroundColor: "#4b5563" }, pushMutation.isPending && { opacity: 0.6 }]}
              onPress={() => pushMutation.mutate()}
              disabled={pushMutation.isPending}
            >
              {pushMutation.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.primaryBtnText}>⬆ Push to GitHub</Text>
              }
            </Pressable>
          ) : execution.status === "pushed" && execution.github_url ? (
            <Pressable
              style={[s.primaryBtn, { backgroundColor: C.purple }]}
              onPress={() => Linking.openURL(execution.github_url)}
            >
              <Text style={s.primaryBtnText}>↗ View on GitHub</Text>
            </Pressable>
          ) : (
            <View style={s.runningBanner}>
              <ActivityIndicator color={C.blue} size="small" />
              <Text style={{ color: C.blue, marginLeft: 8, fontSize: 13 }}>
                {execution.status === "running" ? "Building in progress…" : `Status: ${execution.status}`}
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

function OrchestratorApp() {
  const qclient = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const ideasQ = useQuery({
    queryKey: ["ideas"],
    queryFn: () => fetchIdeas(),
    refetchInterval: 30_000,
  });

  const execQ = useQuery({
    queryKey: ["executions"],
    queryFn: fetchExecutions,
    refetchInterval: 8_000,
  });

  const forceRunMutation = useMutation({
    mutationFn: forceRun,
    onSuccess: () => Alert.alert("Agent Dispatched", "New ideas are being generated…"),
    onError: (e) => Alert.alert("Error", e.message),
  });

  // Map idea_id → execution
  const execMap = {};
  (execQ.data?.executions ?? []).forEach((ex) => { execMap[ex.idea_id] = ex; });

  const ideas = ideasQ.data?.ideas ?? [];

  const openIdea = (idea, execution) => {
    setSelected(idea);
    setSelectedExecution(execution ?? null);
    setModalVisible(true);
  };

  const refresh = useCallback(() => {
    qclient.invalidateQueries(["ideas"]);
    qclient.invalidateQueries(["executions"]);
  }, [qclient]);

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: C.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.logoMark}><Text style={{ color: "#fff", fontSize: 13 }}>⚡</Text></View>
          <Text style={s.headerTitle}>Idea Orchestrator</Text>
        </View>
        <Pressable
          style={[s.forceBtn, forceRunMutation.isPending && { opacity: 0.6 }]}
          onPress={() => forceRunMutation.mutate()}
          disabled={forceRunMutation.isPending}
        >
          {forceRunMutation.isPending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.forceBtnText}>Force Idea</Text>
          }
        </Pressable>
      </View>

      {/* Stats row */}
      <View style={s.statsRow}>
        <View style={s.statCell}>
          <Text style={[s.statNum, { color: C.indigo }]}>{ideas.length}</Text>
          <Text style={s.statLabel}>Total</Text>
        </View>
        {(["simple", "medium", "complex"] as const).map((c) => (
          <View key={c} style={s.statCell}>
            <Text style={[s.statNum, { color: COMPLEXITY[c].color }]}>
              {ideas.filter(i => i.complexity === c).length}
            </Text>
            <Text style={s.statLabel}>{COMPLEXITY[c].label}</Text>
          </View>
        ))}
        <View style={s.statCell}>
          <Text style={[s.statNum, { color: C.blue }]}>
            {(execQ.data?.executions ?? []).length}
          </Text>
          <Text style={s.statLabel}>Executed</Text>
        </View>
      </View>

      {/* Ideas list */}
      {ideasQ.isLoading ? (
        <ActivityIndicator color={C.indigo} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={ideas}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <IdeaCard
              idea={item}
              execution={execMap[item._id]}
              onPress={openIdea}
            />
          )}
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={
            <RefreshControl refreshing={ideasQ.isFetching} onRefresh={refresh} tintColor={C.indigo} />
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <Text style={{ fontSize: 32, marginBottom: 12 }}>⚡</Text>
              <Text style={{ color: C.muted, fontSize: 14 }}>No ideas yet. Tap Force Idea.</Text>
            </View>
          }
        />
      )}

      <IdeaModal
        idea={selected}
        execution={selectedExecution}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <OrchestratorApp />
    </QueryClientProvider>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoMark: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: C.indigo,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { color: C.text, fontSize: 15, fontWeight: "600" },
  forceBtn: {
    backgroundColor: C.indigo, paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 10, minWidth: 44, alignItems: "center",
  },
  forceBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  statsRow: {
    flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  statCell: { flex: 1, alignItems: "center", paddingVertical: 10 },
  statNum: { fontSize: 18, fontWeight: "700", fontVariant: ["tabular-nums"] },
  statLabel: { color: C.muted, fontSize: 10, marginTop: 1 },

  card: {
    backgroundColor: C.surface, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" },
  cardName: { color: C.text, fontSize: 15, fontWeight: "600", marginBottom: 3 },
  cardTagline: { color: "#94a3b8", fontSize: 12, marginBottom: 6, lineHeight: 17 },
  cardDesc: { color: C.muted, fontSize: 12, lineHeight: 17, marginBottom: 10 },
  cardMeta: { flexDirection: "row", gap: 12 },
  metaItem: { color: C.muted, fontSize: 11 },

  badge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 99, borderWidth: 1,
  },
  badgeDot: { width: 5, height: 5, borderRadius: 99 },
  badgeText: { fontSize: 10, fontWeight: "600" },

  modalHeader: {
    flexDirection: "row", alignItems: "flex-start",
    padding: 16, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalTitle: { color: C.text, fontSize: 18, fontWeight: "700", marginBottom: 3 },
  modalTagline: { color: "#94a3b8", fontSize: 13 },
  closeBtn: { padding: 4, marginLeft: 8 },

  sectionLabel: { color: C.muted, fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 16 },
  sectionBody: { color: C.text, fontSize: 13, lineHeight: 20, marginBottom: 4 },
  listItem: { color: C.text, fontSize: 13, lineHeight: 22, marginLeft: 4 },

  techPill: {
    backgroundColor: "#ffffff0d", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  techText: { color: C.muted, fontSize: 11 },

  metaGrid: { flexDirection: "row", gap: 8, marginTop: 16 },
  metaCell: {
    flex: 1, backgroundColor: "#ffffff06", borderRadius: 10,
    padding: 10, borderWidth: 1, borderColor: C.border,
  },
  metaCellLabel: { color: C.muted, fontSize: 10, marginBottom: 3 },
  metaCellVal: { color: C.text, fontSize: 13, fontWeight: "600" },

  modalFooter: {
    padding: 16, borderTopWidth: 1, borderTopColor: C.border,
  },
  primaryBtn: {
    backgroundColor: C.indigo, paddingVertical: 14, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  primaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  runningBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 12,
  },
});
