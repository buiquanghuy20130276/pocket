import React from "react";
import { Redirect } from "expo-router";

export default function CircleRedirect() {
  return <Redirect href="/(tabs)/feed" />;
}
