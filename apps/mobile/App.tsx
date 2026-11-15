import { useEffect, useState } from "react";
import {
  FlatList,
  I18nManager,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useChatStore } from "@newchat/core-client";

if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
}

export default function App() {
  const [username, setUsername] = useState("");
  const [draft, setDraft] = useState("");

  const initialize = useChatStore((s) => s.initialize);
  const connected = useChatStore((s) => s.connected);
  const isAuthenticated = useChatStore((s) => s.isAuthenticated);
  const onlineCount = useChatStore((s) => s.onlineCount);
  const messages = useChatStore((s) => s.messages);
  const me = useChatStore((s) => s.me);
  const loginGuest = useChatStore((s) => s.loginGuest);
  const sendRoomMessage = useChatStore((s) => s.sendRoomMessage);
  const logout = useChatStore((s) => s.logout);

  useEffect(() => {
    initialize({
      apiUrl: "http://127.0.0.1:3003",
      gatewayUrl: "http://127.0.0.1:3004",
    });
  }, [initialize]);

  return (
    <SafeAreaView style={styles.root}>
      {!isAuthenticated ? (
        <View style={styles.card}>
          <Text style={styles.title}>NewChat — تطبيق الجوال</Text>
          <Text style={styles.subtitle}>
            {connected ? `متصل بالخادم • ${onlineCount} متواجد` : "جاري الاتصال..."}
          </Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="اكتب الاسم المستعار..."
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
          <TouchableOpacity
            style={styles.button}
            onPress={() => username.trim() && loginGuest(username)}
            disabled={!connected}
          >
            <Text style={styles.buttonText}>دخول مباشر</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.chatContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>أهلاً {me?.topic || ""}</Text>
            <TouchableOpacity onPress={logout}>
              <Text style={styles.logoutText}>خروج</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={messages}
            keyExtractor={(item: any, idx) => String(item.mi || idx)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.msgItem}>
                <Text style={styles.msgAuthor}>{item.topic}</Text>
                <Text style={styles.msgBody}>{item.msg}</Text>
              </View>
            )}
          />

          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="اكتب رسالتك..."
              placeholderTextColor="#94a3b8"
              style={styles.composerInput}
            />
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={() => {
                if (draft.trim()) {
                  sendRoomMessage(draft);
                  setDraft("");
                }
              }}
            >
              <Text style={styles.buttonText}>إرسال</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#020617", justifyContent: "center" },
  card: { margin: 20, padding: 24, borderRadius: 20, backgroundColor: "#0f172a", gap: 14 },
  title: { color: "#f8fafc", fontSize: 22, fontWeight: "700", textAlign: "center" },
  subtitle: { color: "#94a3b8", fontSize: 13, textAlign: "center" },
  input: {
    backgroundColor: "#020617",
    color: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1e293b",
    textAlign: "right",
  },
  button: { backgroundColor: "#4f46e5", padding: 14, borderRadius: 12, alignItems: "center" },
  buttonText: { color: "#ffffff", fontWeight: "700" },
  chatContainer: { flex: 1 },
  header: {
    padding: 14,
    backgroundColor: "#0f172a",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "700" },
  logoutText: { color: "#fb7185", fontWeight: "700" },
  listContent: { padding: 12, gap: 8 },
  msgItem: { backgroundColor: "#0f172a", padding: 12, borderRadius: 12 },
  msgAuthor: { color: "#818cf8", fontSize: 12, fontWeight: "700", textAlign: "right" },
  msgBody: { color: "#e2e8f0", fontSize: 14, marginTop: 4, textAlign: "right" },
  composer: {
    padding: 10,
    backgroundColor: "#0f172a",
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  composerInput: {
    flex: 1,
    backgroundColor: "#020617",
    color: "#f8fafc",
    borderRadius: 12,
    padding: 10,
    textAlign: "right",
  },
  sendBtn: { backgroundColor: "#4f46e5", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
});
