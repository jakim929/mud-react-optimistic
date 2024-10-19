let isOn = false
export const devConsole = new Proxy(console, {
  get(target, prop) {
    if (!isOn) return () => { }
    return Reflect.get(target, prop)
  },
});
