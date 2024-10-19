// this is copy pasted from source code for convenience
import { SyncOptions, SyncResult, mudTables, SyncStep, configToTables } from "@latticexyz/store-sync";
import { ZustandStore, createStore, createStorageAdapter } from "@latticexyz/store-sync/zustand";
import { createStoreSync } from "@latticexyz/store-sync";
import { Address } from "viem";
import { Store as StoreConfig } from "@latticexyz/store";
import { Tables } from "@latticexyz/config";
import { merge } from "@ark/util";

export type SyncToZustandOptions<config extends StoreConfig, extraTables extends Tables> = SyncOptions & {
  // require address for now to keep the data model + retrieval simpler
  address: Address;
  config: config;
  tables?: extraTables;
  store?: ZustandStore<merge<merge<configToTables<config>, extraTables>, mudTables>>;
  startSync?: boolean;
};

export type SyncToZustandResult<config extends StoreConfig, extraTables extends Tables> = SyncResult & {
  tables: merge<merge<configToTables<config>, extraTables>, mudTables>;
  useStore: ZustandStore<merge<merge<configToTables<config>, extraTables>, mudTables>>;
  stopSync: () => void;
};

export async function syncToZustand<config extends StoreConfig, extraTables extends Tables = {}>({
  config,
  tables: extraTables = {} as extraTables,
  store,
  startSync = true,
  ...syncOptions
}: SyncToZustandOptions<config, extraTables>): Promise<SyncToZustandResult<config, extraTables>> {
  const tables = {
    ...configToTables(config),
    ...extraTables,
    ...mudTables,
  } as unknown as merge<merge<configToTables<config>, extraTables>, mudTables>;
  const useStore = store ?? createStore({ tables });
  const storageAdapter = createStorageAdapter({ store: useStore });

  const storeSync = await createStoreSync({
    storageAdapter,
    ...syncOptions,
    onProgress: (syncProgress) => {
      // already live, no need for more progress updates
      if (useStore.getState().syncProgress.step === SyncStep.LIVE) return;
      useStore.setState(() => ({ syncProgress }));
    },
  });

  const sub = startSync ? storeSync.storedBlockLogs$.subscribe() : null;
  const stopSync = (): void => {
    sub?.unsubscribe();
  };

  return {
    ...storeSync,
    tables,
    useStore,
    stopSync,
  };
}
