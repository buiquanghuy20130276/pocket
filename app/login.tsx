import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { useAuthStore } from "../src/core/store";
import { useRouter } from "expo-router";
import { THEME } from "../src/core/theme";
import { Ionicons } from "@expo/vector-icons";

const DEFAULT_ONBOARDING_CATEGORIES = [
  { name: "Ăn uống", icon: "restaurant", color: "#FF9500" },
  { name: "Di chuyển", icon: "car", color: "#5AC8FA" },
  { name: "Mua sắm", icon: "bag-handle", color: "#FF2D55" },
  { name: "Sức khỏe", icon: "heart", color: "#4CD964" },
  { name: "Giải trí", icon: "game-controller", color: "#5856D6" },
  { name: "Chi phí khác", icon: "ellipsis-horizontal-circle", color: "#8E8E93" }
];

export default function Login() {
  const router = useRouter();
  const {
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    saveProfile,
    isOnboarding,
    isLoading,
    errorMessage,
  } = useAuthStore();

  const [activeScreen, setActiveScreen] = useState<"welcome" | "signin" | "signup">("welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [onboardingStep, setOnboardingStep] = useState<1 | 2>(1);
  const [selectedCats, setSelectedCats] = useState<string[]>(DEFAULT_ONBOARDING_CATEGORIES.map(c => c.name));

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập đầy đủ thông tin.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Lỗi", "Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Lỗi", "Mật khẩu xác nhận không trùng khớp.");
      return;
    }
    // signUpWithEmail sets isOnboarding: true on success—no email confirmation needed
    await signUpWithEmail(email.trim(), password);
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập đầy đủ thông tin.");
      return;
    }
    const success = await signInWithEmail(email.trim(), password);
    if (success) {
      router.replace("/(tabs)/feed");
    }
  };

  const handleGoogleLogin = () => {
    signInWithGoogle();
  };

  const handleSaveProfile = async () => {
    if (!username.trim()) return;
    const catsToSave = DEFAULT_ONBOARDING_CATEGORIES.filter(c => selectedCats.includes(c.name));
    const success = await saveProfile(username.trim(), displayName.trim(), catsToSave);
    if (success) {
      router.replace("/(tabs)/feed");
    }
  };

  const handleNextStep = () => {
    if (!username.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập tên người dùng.");
      return;
    }
    setOnboardingStep(2);
  };

  // -------------------------------------------------------------
  // SCREEN 1: ONBOARDING PROFILE SETUP
  // -------------------------------------------------------------
  if (isOnboarding) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {onboardingStep === 1 ? (
            <View style={styles.content}>
              <View style={styles.titleGroup}>
                <Text style={styles.title}>Thiết lập hồ sơ</Text>
                <Text style={styles.subtitle}>Bạn bè trong nhóm sẽ nhìn thấy thông tin này</Text>
              </View>

              <View style={styles.avatarRow}>
                <View style={styles.avatarBorder}>
                  <Ionicons name="person" size={28} color={THEME.green.text} />
                  <View style={styles.plusBadge}>
                    <Ionicons name="add" size={10} color="#fff" />
                  </View>
                </View>
                <View style={styles.avatarInputs}>
                  <TextInput
                    style={styles.smallInput}
                    placeholder="Họ và tên"
                    placeholderTextColor={THEME.textTertiary}
                    value={displayName}
                    onChangeText={setDisplayName}
                  />
                  <TextInput
                    style={styles.smallInput}
                    placeholder="@username (ví dụ: huyquang)"
                    placeholderTextColor={THEME.textTertiary}
                    value={username}
                    onChangeText={(val) => setUsername(val.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

              <TouchableOpacity
                style={[styles.primaryBtn, !username.trim() && styles.primaryBtnDisabled]}
                onPress={handleNextStep}
                disabled={!username.trim()}
              >
                <Text style={styles.primaryBtnText}>Tiếp tục</Text>
              </TouchableOpacity>

              <View style={styles.indicatorRow}>
                <View style={[styles.indicatorStep, styles.stepActive]} />
                <View style={[styles.indicatorStep, styles.stepActive]} />
                <View style={styles.indicatorStep} />
              </View>
            </View>
          ) : (
            <View style={styles.content}>
              <View style={styles.titleGroup}>
                <Text style={styles.title}>Chọn danh mục chi tiêu</Text>
                <Text style={styles.subtitle}>Chọn các danh mục bạn muốn sử dụng để ghi chi tiêu nhóm</Text>
              </View>

              <View style={styles.onboardingCatList}>
                {DEFAULT_ONBOARDING_CATEGORIES.map((cat) => {
                  const isSelected = selectedCats.includes(cat.name);
                  const palette = {
                    bg: cat.color + "1A", // ~10% opacity
                    color: cat.color
                  };
                  return (
                    <TouchableOpacity
                      key={cat.name}
                      style={[
                        styles.onboardingCatCard,
                        isSelected && styles.onboardingCatCardSelected
                      ]}
                      onPress={() => {
                        if (isSelected) {
                          if (selectedCats.length > 1) {
                            setSelectedCats(selectedCats.filter(name => name !== cat.name));
                          } else {
                            Alert.alert("Thông báo", "Bạn cần chọn ít nhất 1 danh mục.");
                          }
                        } else {
                          setSelectedCats([...selectedCats, cat.name]);
                        }
                      }}
                    >
                      <View style={[styles.onboardingCatIconCircle, { backgroundColor: palette.bg }]}>
                        <Ionicons name={cat.icon as any} size={16} color={palette.color} />
                      </View>
                      <Text style={[styles.onboardingCatName, isSelected && { fontWeight: "600" }]}>{cat.name}</Text>
                      <View style={[
                        styles.checkboxOuter,
                        isSelected && styles.checkboxOuterChecked
                      ]}>
                        {isSelected && (
                          <Ionicons name="checkmark" size={10} color="#fff" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

              <View style={styles.onboardingBtnsRow}>
                <TouchableOpacity
                  style={styles.onboardingBackBtn}
                  onPress={() => setOnboardingStep(1)}
                  disabled={isLoading}
                >
                  <Text style={styles.onboardingBackBtnText}>Quay lại</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.onboardingSubmitBtn, isLoading && { opacity: 0.6 }]}
                  onPress={handleSaveProfile}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={THEME.buttonText} />
                  ) : (
                    <Text style={styles.primaryBtnText}>Hoàn tất thiết lập</Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.indicatorRow}>
                <View style={[styles.indicatorStep, styles.stepActive]} />
                <View style={[styles.indicatorStep, styles.stepActive]} />
                <View style={[styles.indicatorStep, styles.stepActive]} />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // -------------------------------------------------------------
  // SCREEN 2: SIGN IN FORM
  // -------------------------------------------------------------
  if (activeScreen === "signin") {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setActiveScreen("welcome")}>
            <Ionicons name="chevron-back" size={20} color={THEME.textPrimary} />
            <Text style={styles.backBtnText}>Quay lại</Text>
          </TouchableOpacity>

          <View style={styles.content}>
            <View style={styles.titleGroup}>
              <Text style={styles.title}>Đăng nhập</Text>
              <Text style={styles.subtitle}>Chào mừng trở lại! Nhập email của bạn để tiếp tục</Text>
            </View>

            <View style={styles.formCard}>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={16} color={THEME.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Địa chỉ email"
                  placeholderTextColor={THEME.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={[styles.inputContainer, { marginTop: 12 }]}>
                <Ionicons name="lock-closed-outline" size={16} color={THEME.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Mật khẩu"
                  placeholderTextColor={THEME.textTertiary}
                  secureTextEntry={true}
                  autoCapitalize="none"
                  value={password}
                  onChangeText={setPassword}
                />
              </View>
            </View>

            {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: 16 }]}
              onPress={handleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={THEME.buttonText} />
              ) : (
                <Text style={styles.primaryBtnText}>Đăng nhập</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchModeBtn}
              onPress={() => {
                useAuthStore.setState({ errorMessage: null });
                setActiveScreen("signup");
              }}
            >
              <Text style={styles.switchModeText}>
                Chưa có tài khoản? <Text style={styles.switchModeTextHighlight}>Đăng ký ngay</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // -------------------------------------------------------------
  // SCREEN 3: SIGN UP FORM
  // -------------------------------------------------------------
  if (activeScreen === "signup") {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setActiveScreen("welcome")}>
            <Ionicons name="chevron-back" size={20} color={THEME.textPrimary} />
            <Text style={styles.backBtnText}>Quay lại</Text>
          </TouchableOpacity>

          <View style={styles.content}>
            <View style={styles.titleGroup}>
              <Text style={styles.title}>Tạo tài khoản mới</Text>
              <Text style={styles.subtitle}>Đăng ký bằng email và mật khẩu của bạn</Text>
            </View>

            <View style={styles.formCard}>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={16} color={THEME.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Địa chỉ email"
                  placeholderTextColor={THEME.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={[styles.inputContainer, { marginTop: 12 }]}>
                <Ionicons name="lock-closed-outline" size={16} color={THEME.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Mật khẩu (tối thiểu 6 ký tự)"
                  placeholderTextColor={THEME.textTertiary}
                  secureTextEntry={true}
                  autoCapitalize="none"
                  value={password}
                  onChangeText={setPassword}
                />
              </View>

              <View style={[styles.inputContainer, { marginTop: 12 }]}>
                <Ionicons name="checkmark-circle-outline" size={16} color={THEME.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Xác nhận mật khẩu"
                  placeholderTextColor={THEME.textTertiary}
                  secureTextEntry={true}
                  autoCapitalize="none"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              </View>
            </View>

            {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: 16 }]}
              onPress={handleSignUp}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={THEME.buttonText} />
              ) : (
                <Text style={styles.primaryBtnText}>Đăng ký tài khoản</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchModeBtn}
              onPress={() => {
                useAuthStore.setState({ errorMessage: null });
                setActiveScreen("signin");
              }}
            >
              <Text style={styles.switchModeText}>
                Đã có tài khoản? <Text style={styles.switchModeTextHighlight}>Đăng nhập</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // -------------------------------------------------------------
  // SCREEN 4: SPLASH / WELCOME SCREEN
  // -------------------------------------------------------------
  return (
    <View style={styles.splashContainer}>
      <View style={styles.splashContent}>
        <View style={styles.logoBox}>
          <Ionicons name="images" size={32} color={THEME.textSecondary} />
        </View>
        <View style={styles.textGroup}>
          <Text style={styles.appName}>Pocket</Text>
          <Text style={styles.tagline}>Chia sẻ khoảnh khắc.{"\n"}Theo dõi chi tiêu nhóm.</Text>
        </View>

        <View style={styles.actionGroup}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => setActiveScreen("signup")}
          >
            <Text style={styles.primaryBtnText}>Đăng ký tài khoản mới</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => setActiveScreen("signin")}
          >
            <Text style={styles.secondaryBtnText}>Đăng nhập bằng Email</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleLogin}>
            <Ionicons name="logo-google" size={16} color="#444441" style={{ marginRight: 8 }} />
            <Text style={styles.googleBtnText}>Tiếp tục với Google</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.policyText}>
          Bằng cách tiếp tục, bạn đồng ý với{"\n"}Điều khoản & Chính sách bảo mật của SnapLedger
        </Text>
      </View>
    </View>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.backgroundPrimary,
  },
  splashContainer: {
    flex: 1,
    backgroundColor: THEME.backgroundPrimary,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  splashContent: {
    alignItems: "center",
    width: "100%",
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: THEME.backgroundSecondary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: THEME.borderPrimary,
    marginBottom: 24,
  },
  textGroup: {
    alignItems: "center",
    marginBottom: 36,
  },
  appName: {
    fontSize: 26,
    fontWeight: "700",
    color: THEME.textPrimary,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    color: THEME.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  actionGroup: {
    width: "100%",
    gap: 12,
    marginBottom: 28,
  },
  primaryBtn: {
    backgroundColor: THEME.buttonPrimary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: THEME.buttonText,
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryBtn: {
    backgroundColor: THEME.backgroundSecondary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    width: "100%",
  },
  secondaryBtnText: {
    color: THEME.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  googleBtn: {
    backgroundColor: "#F1EFE8",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: "#D3D1C7",
    flexDirection: "row",
    width: "100%",
  },
  googleBtnText: {
    color: "#2C2C2A",
    fontSize: 16,
    fontWeight: "600",
  },
  policyText: {
    fontSize: 12,
    color: THEME.textTertiary,
    textAlign: "center",
    lineHeight: 16,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: Platform.OS === "ios" ? 44 : 20,
    paddingVertical: 8,
    gap: 6,
  },
  backBtnText: {
    fontSize: 16,
    color: THEME.textPrimary,
    fontWeight: "500",
  },
  content: {
    paddingVertical: 20,
  },
  titleGroup: {
    marginBottom: 24,
    marginTop: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: THEME.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: THEME.textSecondary,
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: THEME.backgroundSecondary,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    padding: 16,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.backgroundPrimary,
    borderWidth: 0.5,
    borderColor: THEME.borderPrimary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: THEME.textPrimary,
    padding: 0,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
  },
  avatarBorder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: THEME.green.bg,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  plusBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: THEME.buttonPrimary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: THEME.backgroundPrimary,
  },
  avatarInputs: {
    flex: 1,
    gap: 10,
  },
  smallInput: {
    backgroundColor: THEME.backgroundSecondary,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    color: THEME.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.textSecondary,
    marginBottom: 8,
  },
  budgetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderPrimary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  budgetValue: {
    fontSize: 16,
    color: THEME.textPrimary,
    fontWeight: "500",
    padding: 0,
    flex: 1,
  },
  budgetCurrency: {
    fontSize: 15,
    color: THEME.textSecondary,
  },
  errorText: {
    color: THEME.red.solid,
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
  },
  indicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    marginTop: 28,
  },
  indicatorStep: {
    width: 36,
    height: 2,
    borderRadius: 1,
    backgroundColor: THEME.borderSecondary,
  },
  stepActive: {
    backgroundColor: THEME.buttonPrimary,
  },
  switchModeBtn: {
    marginTop: 20,
    alignItems: "center",
  },
  switchModeText: {
    fontSize: 14,
    color: THEME.textSecondary,
  },
  switchModeTextHighlight: {
    color: THEME.textPrimary,
    fontWeight: "700",
  },
  onboardingCatList: {
    marginTop: 12,
    gap: 10,
  },
  onboardingCatCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.backgroundSecondary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
  },
  onboardingCatCardSelected: {
    borderColor: THEME.textPrimary,
  },
  onboardingCatIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  onboardingCatName: {
    fontSize: 16,
    color: THEME.textPrimary,
    flex: 1,
  },
  checkboxOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: THEME.borderPrimary,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxOuterChecked: {
    backgroundColor: THEME.buttonPrimary,
    borderColor: THEME.buttonPrimary,
  },
  onboardingBtnsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  onboardingBackBtn: {
    flex: 1,
    backgroundColor: THEME.backgroundSecondary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
  },
  onboardingBackBtnText: {
    color: THEME.textSecondary,
    fontSize: 16,
    fontWeight: "600",
  },
  onboardingSubmitBtn: {
    flex: 2,
    backgroundColor: THEME.buttonPrimary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
