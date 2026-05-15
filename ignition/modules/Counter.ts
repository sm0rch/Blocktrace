import { buildModule } from "@nomicfoundation/ignition-core";

export default buildModule("CounterModule", (m) => {
  const admin = m.getAccount(0);
  const counter = m.contract("Counter", [admin]); 
  return { counter };
});
