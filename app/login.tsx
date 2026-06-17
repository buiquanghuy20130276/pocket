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
} from "react-native";
import { useAuthStore } from "../src/core/store";
import { useRouter } from "expo-router";
import { THEME } from "../src/core/theme";
import { Ionicons } from "@expo/vector-icons";

export default function Login() {
  const router = useRouter();
  const {
    signInWithOTP,
    verifyOTP,
    saveProfile,
    isOTPSent,
    isOnboarding,
    isLoading,
    errorMessage,
  } = useAuthStore();

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [monthlyBudget, setMonthlyBudget] = useState("5000000");

  const handleSendOTP = () => {
    if (phone.trim()) {
      signInWithOTP(phone.trim());
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.trim()) {
      await verifyOTP(phone.trim(), otp.trim());
    }
  };

  const handleSaveProfile = async () => {
    if (username.trim()) {
      // Save profile with custom budget limit handled inside profile trigger or update
      await saveProfile(username.trim(), displayName.trim());
      
      // Upsert the custom onboarding budget period
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        const dateStr = startOfMonth.toISOString().split("T")[0];
        
        await supabase.from("budget_periods").upsert({
          user_id: session.user.id,
          period_start: dateStr,
          period_end: new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0).toISOString().split("T")[0],
          total_budget: parseInt(monthlyBudget) || 5000000,
          currency: "VND",
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id,period_start" });
      }

      router.replace("/(tabs)/feed");
    }
  };

  // Render Splash / Welcome Screen
  if (!showPhoneInput && !isOTPSent && !isOnboarding) {
    return (
      <View style={styles.splashContainer}>
        <View style={styles.splashContent}>
          <View style={styles.logoBox}>
            <Ionicons name="images" size={32} color={THEME.textSecondary} />
          </View>
          <View style={styles.textGroup}>
            <Text style={styles.appName}>SnapLedger</Text>
            <Text style={styles.tagline}>Share moments.{"\n"}Track money.</Text>
          </View>

          <View style={styles.actionGroup}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => setShowPhoneInput(true)}
            >
              <Text style={styles.primaryBtnText}>Continue with phone</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Sign in with Apple</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.policyText}>
            By continuing you agree to our{"\n"}Terms & Privacy Policy
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {isOnboarding ? (
          // Onboarding Layout (Screen 3: Profile Setup)
          <View style={styles.content}>
            <View style={styles.titleGroup}>
              <Text style={styles.title}>Set up profile</Text>
              <Text style={styles.subtitle}>Your friends will see this</Text>
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
                  placeholder="Nguyen Van A"
                  placeholderTextColor={THEME.textTertiary}
                  value={displayName}
                  onChangeText={setDisplayName}
                />
                <TextInput
                  style={styles.smallInput}
                  placeholder="@username"
                  placeholderTextColor={THEME.textTertiary}
                  value={username}
                  onChangeText={(val) => setUsername(val.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Monthly budget</Text>
              <View style={styles.budgetRow}>
                <TextInput
                  style={styles.budgetValue}
                  value={monthlyBudget}
                  onChangeText={setMonthlyBudget}
                  keyboardType="numeric"
                />
                <Text style={styles.budgetCurrency}>VND</Text>
              </View>
            </View>

            {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

            <TouchableOpacity
              style={[styles.primaryBtn, !username.trim() && styles.primaryBtnDisabled]}
              onPress={handleSaveProfile}
              disabled={!username.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={THEME.buttonText} />
              ) : (
                <Text style={styles.primaryBtnText}>Continue</Text>
              )}
            </TouchableOpacity>

            {/* Indicator steps */}
            <View style={styles.indicatorRow}>
              <View style={[styles.indicatorStep, styles.stepActive]} />
              <View style={styles.indicatorStep} />
              <View style={styles.indicatorStep} />
            </View>
          </View>
        ) : (
          // Phone / OTP Verification (Screen 2)
          <View style={styles.content}>
            <View style={styles.titleGroup}>
              <Text style={styles.title}>
                {isOTPSent ? "Enter OTP Code" : "Your phone number"}
              </Text>
              <Text style={styles.subtitle}>
                {isOTPSent ? "Enter the 6-digit code sent to you" : "We'll send a one-time code"}
              </Text>
            </View>

            {!isOTPSent ? (
              // Enter Phone Number
              <View style={styles.inputRowContainer}>
                <Text style={styles.countryCode}>🇻🇳 +84</Text>
                <View style={styles.verticalLine} />
                <TextInput
                  style={styles.phoneInput}
                  placeholder="Enter phone number"
                  placeholderTextColor={THEME.textTertiary}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  autoFocus={true}
                />
              </View>
            ) : (
              // Enter OTP (Showing custom inputs)
              <View style={styles.otpOuter}>
                <View style={styles.otpGrid}>
                  {Array.from({ length: 6 }).map((_, i) => {
                    const char = otp[i] || "";
                    const isCurrent = i === otp.length;
                    return (
                      <View
                        key={i}
                        style={[
                          styles.otpCell,
                          isCurrent && styles.otpCellCurrent,
                        ]}
                      >
                        <Text style={styles.otpCellText}>
                          {char || (isCurrent ? "_" : "")}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                <TextInput
                  style={styles.hiddenOtpInput}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={setOtp}
                  autoFocus={true}
                />
              </View>
            )}

            {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={isOTPSent ? handleVerifyOTP : handleSendOTP}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={THEME.buttonText} />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {isOTPSent ? "Verify code" : "Send code"}
                </Text>
              )}
            </TouchableOpacity>

            {isOTPSent && (
              <Text style={styles.resendText}>Resend in 0:42</Text>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Inline supabase placeholder import error protection
import { supabase as localSupabase } from "../src/core/supabaseClient";
const supabase = localSupabase;

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
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: THEME.backgroundSecondary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: THEME.borderPrimary,
    marginBottom: 20,
  },
  textGroup: {
    alignItems: "center",
    marginBottom: 32,
  },
  appName: {
    fontSize: 20,
    fontWeight: "600",
    color: THEME.textPrimary,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 12,
    color: THEME.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  actionGroup: {
    width: "100%",
    gap: 8,
    marginBottom: 24,
  },
  primaryBtn: {
    backgroundColor: THEME.buttonPrimary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: THEME.buttonText,
    fontSize: 13,
    fontWeight: "600",
  },
  secondaryBtn: {
    backgroundColor: THEME.backgroundSecondary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    width: "100%",
  },
  secondaryBtnText: {
    color: THEME.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  policyText: {
    fontSize: 9,
    color: THEME.textTertiary,
    textAlign: "center",
    lineHeight: 14,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  content: {
    paddingVertical: 40,
  },
  titleGroup: {
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: THEME.textSecondary,
  },
  inputRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderPrimary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  countryCode: {
    fontSize: 13,
    color: THEME.textSecondary,
  },
  verticalLine: {
    width: 0.5,
    height: 16,
    backgroundColor: THEME.borderPrimary,
    marginHorizontal: 10,
  },
  phoneInput: {
    flex: 1,
    fontSize: 14,
    color: THEME.textPrimary,
    padding: 0,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 20,
  },
  avatarBorder: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: THEME.green.bg,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  plusBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: THEME.buttonPrimary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: THEME.backgroundPrimary,
  },
  avatarInputs: {
    flex: 1,
    gap: 8,
  },
  smallInput: {
    backgroundColor: THEME.backgroundSecondary,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    color: THEME.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: THEME.textSecondary,
    marginBottom: 6,
  },
  budgetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderPrimary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  budgetValue: {
    fontSize: 13,
    color: THEME.textPrimary,
    fontWeight: "500",
    padding: 0,
    flex: 1,
  },
  budgetCurrency: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  errorText: {
    color: THEME.red.solid,
    fontSize: 11,
    textAlign: "center",
    marginBottom: 12,
  },
  indicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
    marginTop: 20,
  },
  indicatorStep: {
    width: 32,
    height: 2,
    borderRadius: 1,
    backgroundColor: THEME.borderSecondary,
  },
  stepActive: {
    backgroundColor: THEME.buttonPrimary,
  },
  otpOuter: {
    marginBottom: 20,
    position: "relative",
  },
  otpGrid: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
  },
  otpCell: {
    width: 32,
    height: 40,
    borderRadius: 8,
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderPrimary,
    justifyContent: "center",
    alignItems: "center",
  },
  otpCellCurrent: {
    borderColor: THEME.buttonPrimary,
    borderWidth: 1.5,
  },
  otpCellText: {
    fontSize: 16,
    fontWeight: "600",
    color: THEME.textPrimary,
  },
  hiddenOtpInput: {
    position: "absolute",
    inset: 0,
    opacity: 0,
  },
  resendText: {
    fontSize: 9,
    color: THEME.textTertiary,
    textAlign: "center",
    marginTop: 12,
  },
});
