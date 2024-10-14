"use client";

import { useRules } from "utils/hooks/useRules";
import { CorrelationTable } from "./CorrelationTable";
import Loading from "app/loading";

export const Client = () => {
  const { data: rules = [], isLoading } = useRules();

  if (isLoading) {
    return <Loading />;
  }

  return <CorrelationTable rules={rules} />;
};
