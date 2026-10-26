package com.setgreet.reactnative

import com.setgreet.model.Operation
import com.setgreet.purchases.SetgreetPurchaseProvider
import com.setgreet.purchases.SetgreetPurchaseSource

/** The native SDK calls the module makes: an interface so their order can be tested. */
internal interface RNSetgreetNativeSdk {
  fun initialize(appKey: String, debugMode: Boolean)
  fun identifyUser(userId: String, attributes: Map<String, Any>?, operation: Operation, locale: String?)
  fun resetUser()
  fun setLocale(locale: String?)
  fun trackEvent(eventName: String, properties: Map<String, Any>?)
  fun trackScreen(screenName: String, properties: Map<String, Any>?)
  fun showFlow(flowId: String)
  fun setPurchaseProvider(provider: SetgreetPurchaseProvider, defaultSource: SetgreetPurchaseSource)
}

/**
 * Puts the module's calls into the native SDK in order.
 *
 * `initialize` runs on the main thread, where the SDK sets up its dependency
 * container. The module's other methods are called on the native modules
 * thread, and on any cold start one that went straight to the SDK could run
 * before that container exists: `identifyUser`, `resetUser`, `trackEvent` and
 * `trackScreen` are then dropped, and `showFlow` crashes. So they are posted to
 * the same main thread, FIFO behind `initialize`, in call order.
 *
 * Registering a purchase provider stays inline: the SDK's registration is
 * synchronized and safe from any thread, and an `identifyUser` posted after it
 * finds the provider when it runs.
 *
 * `setLocale` stays inline too: the SDK's override is synchronized, needs no
 * initialized SDK (before `initialize` it is held and saved when `initialize`
 * runs), and a request posted after it carries the new locale.
 */
internal class RNSetgreetSdkCalls(
  private val sdk: RNSetgreetNativeSdk,
  private val mainThread: RNSetgreetScheduler = RNSetgreetMainThreadScheduler
) {
  fun initialize(appKey: String, debugMode: Boolean) = onMainThread { sdk.initialize(appKey, debugMode) }

  fun identifyUser(userId: String, attributes: Map<String, Any>?, operation: Operation, locale: String?) =
    onMainThread { sdk.identifyUser(userId, attributes, operation, locale) }

  fun resetUser() = onMainThread { sdk.resetUser() }

  fun setLocale(locale: String?) = sdk.setLocale(locale)

  fun trackEvent(eventName: String, properties: Map<String, Any>?) =
    onMainThread { sdk.trackEvent(eventName, properties) }

  fun trackScreen(screenName: String, properties: Map<String, Any>?) =
    onMainThread { sdk.trackScreen(screenName, properties) }

  fun showFlow(flowId: String) = onMainThread { sdk.showFlow(flowId) }

  fun setPurchaseProvider(provider: SetgreetPurchaseProvider, defaultSource: SetgreetPurchaseSource) =
    sdk.setPurchaseProvider(provider, defaultSource)

  private fun onMainThread(call: () -> Unit) {
    mainThread.post(Runnable(call))
  }
}
