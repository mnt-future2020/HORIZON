/**
 * Centralized Razorpay checkout hook.
 * Loads the script once, caches it, and provides openCheckout().
 */

let scriptPromise = null;

function loadScript() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve) => {
    if (document.getElementById("razorpay-script")) { resolve(true); return; }
    const script = document.createElement("script");
    script.id = "razorpay-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => { scriptPromise = null; resolve(false); };
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export function useRazorpay() {
  /**
   * Opens Razorpay checkout modal.
   * @param {Object} opts
   * @param {string} opts.keyId - Razorpay key_id
   * @param {string} opts.orderId - Razorpay order_id
   * @param {number} opts.amount - Amount in rupees (not paise)
   * @param {string} opts.name - Display name (venue name etc.)
   * @param {string} opts.description - Checkout description
   * @param {function} opts.onSuccess - Called with Razorpay response on success
   * @param {function} opts.onDismiss - Called when user closes the modal
   * @returns {Promise<boolean>} true if script loaded, false otherwise
   */
  const openCheckout = async ({ keyId, orderId, amount, name, description, onSuccess, onDismiss }) => {
    const loaded = await loadScript();
    if (!loaded) return false;

    const options = {
      key: keyId,
      amount: amount * 100,
      currency: "INR",
      order_id: orderId,
      name: name || "Horizon Sports",
      description: description || "Payment",
      handler: onSuccess,
      modal: { ondismiss: onDismiss },
      theme: { color: "#3b82f6" },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
    return true;
  };

  return { openCheckout };
}
