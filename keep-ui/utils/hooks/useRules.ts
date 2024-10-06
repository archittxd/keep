import { useSession } from "next-auth/react";
import useSWR, { SWRConfiguration } from "swr";
import { getApiURL } from "utils/apiUrl";
import { fetcher } from "utils/fetcher";
import { useState, useEffect } from "react";
import Pusher from "pusher-js";

export type Rule = {
  id: string;
  name: string;
  item_description: string | null;
  group_description: string | null;
  grouping_criteria: string[];
  definition_cel: string;
  definition: { sql: string; params: {} };
  timeframe: number;
  timeunit: "minutes" | "seconds" | "hours" | "days";
  created_by: string;
  creation_time: string;
  tenant_id: string;
  updated_by: string | null;
  update_time: string | null;
  require_approve: boolean;
  distribution: { [group: string]: { [timestamp: string]: number } };
  incidents: number
};

export const useRules = (options?: SWRConfiguration) => {
  const apiUrl = getApiURL();
  const { data: session } = useSession();

  return useSWR<Rule[]>(
    () => (session ? `${apiUrl}/rules` : null),
    async (url) => fetcher(url, session?.accessToken),
    options
  );
};

export const useAIGeneratedRules = (options?: SWRConfiguration) => {
  const apiUrl = getApiURL();
  const { data: session } = useSession();
  const [pusherChannel, setPusherChannel] = useState<Channel | null>(null);

  const { data, error, isLoading, mutate } = useSWR(
    () => (session ? `${apiUrl}/rules/gen_rules` : null),
    async (url) => {
      const response = await fetcher(url, session?.accessToken);
      const { task_id } = response;

      // Initialize Pusher connection
      const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      });

      const channel = pusher.subscribe(`gen_rules_${task_id}`);
      setPusherChannel(channel);

      return new Promise((resolve, reject) => {
        channel.bind('result', (data: any) => {
          pusher.unsubscribe(`gen_rules_${task_id}`);
          resolve(data);
        });

        // Add a timeout to handle cases where Pusher doesn't respond
        setTimeout(() => {
          pusher.unsubscribe(`gen_rules_${task_id}`);
          reject(new Error('Timeout waiting for AI generated rules'));
        }, 60 * 3 * 1000); // 3 minutes timeout
      });

    },
    {
      ...options,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const mutateAIGeneratedRules = async () => {
    // Unsubscribe from the previous channel if it exists
    if (pusherChannel) {
      pusherChannel.unsubscribe();
    }
    // Set data to undefined to trigger loading state
    await mutate(undefined, { revalidate: true });
  };

  useEffect(() => {
    return () => {
      // Cleanup: unsubscribe from the channel when the component unmounts
      if (pusherChannel) {
        pusherChannel.unsubscribe();
      }
    };
  }, [pusherChannel]);

  return { data, error, isLoading, mutateAIGeneratedRules };
};
