package com.setgreet.reactnative

import com.setgreet.model.Operation
import com.setgreet.purchases.SetgreetPurchaseProvider
import com.setgreet.purchases.SetgreetPurchaseSource
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RNSetgreetSdkCallsTest {

  /** Records what reaches the SDK, and what the SDK looked like at that moment. */
  private class RecordingSdk : RNSetgreetNativeSdk {
    val calls = mutableListOf<String>()
    private var initialized = false
    private var provider: String? = null

    override fun initialize(appKey: String, debugMode: Boolean) {
      initialized = true
      calls += "initialize($appKey)"
    }

    override fun identifyUser(userId: String, attributes: Map<String, Any>?, operation: Operation, locale: String?) {
      calls += "identifyUser($userId, initialized=$initialized, provider=$provider)"
    }

    override fun resetUser() {
      calls += "resetUser(initialized=$initialized, provider=$provider)"
    }

    override fun trackEvent(eventName: String, properties: Map<String, Any>?) {
      calls += "trackEvent($eventName, initialized=$initialized)"
    }

    override fun trackScreen(screenName: String, properties: Map<String, Any>?) {
      calls += "trackScreen($screenName, initialized=$initialized)"
    }

    override fun showFlow(flowId: String) {
      calls += "showFlow($flowId, initialized=$initialized)"
    }

    override fun setPurchaseProvider(provider: SetgreetPurchaseProvider, defaultSource: SetgreetPurchaseSource) {
      this.provider = provider.providerId
      calls += "setPurchaseProvider(${provider.providerId})"
    }
  }

  private val mainThread = FakeScheduler()
  private val sdk = RecordingSdk()
  private val sdkCalls = RNSetgreetSdkCalls(sdk, mainThread)
  private val provider = RNSetgreetPurchaseProvider("revenuecat", RNSetgreetPurchaseBridge(FakeScheduler()))

  @Test
  fun `calls wait behind initialize on the main thread, in call order`() {
    // As JS calls them on a fresh install, before the main thread has run.
    sdkCalls.initialize("app-key", debugMode = false)
    sdkCalls.setPurchaseProvider(provider, SetgreetPurchaseSource.currentOffering)
    sdkCalls.identifyUser("user-1", mapOf("plan" to "pro"), Operation.CREATE, "en-US")
    sdkCalls.trackEvent("app_opened", null)
    sdkCalls.trackScreen("home", null)
    sdkCalls.showFlow("flow-1")
    sdkCalls.resetUser()

    assertEquals("only the registration ran inline", listOf("setPurchaseProvider(revenuecat)"), sdk.calls)

    mainThread.runPosted()

    assertEquals(
      listOf(
        "setPurchaseProvider(revenuecat)",
        "initialize(app-key)",
        "identifyUser(user-1, initialized=true, provider=revenuecat)",
        "trackEvent(app_opened, initialized=true)",
        "trackScreen(home, initialized=true)",
        "showFlow(flow-1, initialized=true)",
        "resetUser(initialized=true, provider=revenuecat)"
      ),
      sdk.calls
    )
  }

  @Test
  fun `a registration after initialize ran still happens inline`() {
    sdkCalls.initialize("app-key", debugMode = true)
    mainThread.runPosted()

    sdkCalls.setPurchaseProvider(provider, SetgreetPurchaseSource.offering("onboarding"))

    assertTrue(mainThread.posted.isEmpty())
    assertEquals(listOf("initialize(app-key)", "setPurchaseProvider(revenuecat)"), sdk.calls)
  }

  @Test
  fun `nothing but the registration reaches the SDK before the main thread runs`() {
    sdkCalls.identifyUser("user-1", null, Operation.UPDATE, null)
    sdkCalls.trackEvent("app_opened", mapOf("source" to "push"))
    sdkCalls.initialize("app-key", debugMode = false)

    assertTrue(sdk.calls.isEmpty())
    assertEquals(3, mainThread.posted.size)

    mainThread.runPosted()

    // Called before initialize, they still run in call order: the SDK's own
    // pre-initialize handling applies to them, exactly as it did before.
    assertEquals(
      listOf(
        "identifyUser(user-1, initialized=false, provider=null)",
        "trackEvent(app_opened, initialized=false)",
        "initialize(app-key)"
      ),
      sdk.calls
    )
  }
}
