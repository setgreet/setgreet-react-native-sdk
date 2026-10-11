package com.setgreet.reactnative

import com.setgreet.purchases.SetgreetPaywallImpressionContext
import com.setgreet.purchases.SetgreetPurchaseError
import com.setgreet.purchases.SetgreetPurchaseErrorCode
import com.setgreet.purchases.SetgreetPurchaseSource
import com.setgreet.purchases.SetgreetPurchaseStatus
import com.setgreet.purchases.SetgreetRestoreStatus
import java.math.BigDecimal
import java.util.concurrent.Executors
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RNSetgreetPurchaseBridgeTest {

  private val scheduler = FakeScheduler()

  // Held here: the bridge only keeps a weak reference to its sender.
  private val sender = FakeSender()
  private val bridge = RNSetgreetPurchaseBridge(scheduler).apply { attach(sender) }
  private val provider = RNSetgreetPurchaseProvider("revenuecat", bridge, safetyTimeoutMs = 250)
  private val onboarding = SetgreetPurchaseSource.offering("onboarding")

  private fun annual(price: Any? = 49.99): Map<String, Any?> = mapOf(
    "ref" to "\$rc_annual",
    "storeProductId" to "com.app.annual",
    "localizedPrice" to "\$49.99",
    "priceAmount" to price,
    "currencyCode" to "USD"
  )

  @Test
  fun `loadProducts sends its source and decodes the answer`() {
    val call = start { provider.loadProducts(onboarding) }

    assertFalse(call.isDone)
    assertEquals(
      listOf(
        mapOf(
          "requestId" to sender.requestId(),
          "method" to "loadProducts",
          "args" to mapOf("source" to mapOf("sourceType" to "offering", "sourceId" to "onboarding"))
        )
      ),
      sender.sent
    )
    assertEquals("the injected safety timeout", listOf(250L), scheduler.delayed.map { it.second })

    bridge.resolve(sender.requestId(), mapOf("products" to listOf(annual())), null)

    val products = call.value()
    assertEquals(listOf("\$rc_annual"), products.map { it.ref })
    assertEquals(BigDecimal("49.99"), products.single().priceAmount)
    assertTrue("the timeout is cancelled", scheduler.delayed.isEmpty())
  }

  @Test
  fun `an answer settles a call exactly once and later answers are ignored`() {
    val call = start { provider.requestPurchase("\$rc_annual", onboarding) }
    val id = sender.requestId()

    bridge.resolve(id, mapOf("status" to "purchased", "accessRefs" to listOf("premium")), null)
    bridge.resolve(id, mapOf("status" to "failed"), null)
    bridge.resolve(id, null, mapOf("code" to "unknown"))

    assertEquals(1, call.resumes)
    assertEquals(SetgreetPurchaseStatus.PURCHASED, call.value().status)
    assertEquals(listOf("premium"), call.value().accessRefs)
  }

  @Test
  fun `a late answer after the timeout is ignored`() {
    val call = start { provider.loadProducts(onboarding) }
    val id = sender.requestId()

    scheduler.elapse()
    bridge.resolve(id, mapOf("products" to listOf(annual())), null)

    assertEquals(1, call.resumes)
    val error = call.failure() as SetgreetPurchaseError
    assertEquals(SetgreetPurchaseErrorCode.NETWORK_ERROR, error.code)
    assertEquals("timeout", error.providerCode)
  }

  @Test
  fun `an accessState that times out cannot say`() {
    val call = start { provider.accessState() }
    val id = sender.requestId()

    scheduler.elapse()
    bridge.resolve(id, mapOf("accessState" to mapOf("active" to true, "accessRefs" to listOf("premium"))), null)

    assertEquals(1, call.resumes)
    assertNull(call.value())
  }

  @Test
  fun `a short real timeout fires on time and the late answer is ignored`() {
    val executor = Executors.newSingleThreadScheduledExecutor()
    try {
      val timedBridge = RNSetgreetPurchaseBridge(ExecutorScheduler(executor)).apply { attach(sender) }
      val timedProvider = RNSetgreetPurchaseProvider("revenuecat", timedBridge, safetyTimeoutMs = 30)

      val call = start { timedProvider.loadProducts(onboarding) }

      assertTrue("settles once the 30 ms limit passes", call.await(5_000))
      assertEquals("timeout", (call.failure() as SetgreetPurchaseError).providerCode)
      timedBridge.resolve(sender.requestId(), mapOf("products" to listOf(annual())), null)
      assertEquals(1, call.resumes)
    } finally {
      executor.shutdownNow()
    }
  }

  @Test
  fun `purchase, restore, identify and reset have no time limit`() {
    start { provider.requestPurchase("\$rc_annual", onboarding) }
    start { provider.restorePurchases() }
    start { provider.identify("user-1") }
    start { provider.reset() }

    assertEquals(listOf("purchase", "restorePurchases", "identify", "reset"), sender.sent.map { it["method"] })
    assertEquals(mapOf("userId" to "user-1"), sender.sent[2]["args"])
    assertTrue(scheduler.delayed.isEmpty())
  }

  @Test
  fun `invalidate settles every waiting call as specified`() {
    val load = start { provider.loadProducts(onboarding) }
    val purchase = start { provider.requestPurchase("\$rc_annual", onboarding) }
    val restore = start { provider.restorePurchases() }
    val access = start { provider.accessState() }
    val identify = start { provider.identify("user-1") }
    val reset = start { provider.reset() }
    listOf(load, purchase, restore, access, identify, reset).forEach { assertFalse(it.isDone) }

    bridge.invalidate()

    assertEquals(SetgreetPurchaseErrorCode.NOT_CONFIGURED, (load.failure() as SetgreetPurchaseError).code)
    assertEquals(SetgreetPurchaseStatus.FAILED, purchase.value().status)
    assertEquals(SetgreetPurchaseErrorCode.NOT_CONFIGURED, purchase.value().error?.code)
    assertEquals(SetgreetRestoreStatus.FAILED, restore.value().status)
    assertEquals(SetgreetPurchaseErrorCode.NOT_CONFIGURED, restore.value().error?.code)
    assertNull(access.value())
    assertEquals(Unit, identify.value())
    assertEquals(Unit, reset.value())
    listOf(load, purchase, restore, access, identify, reset).forEach { assertEquals(1, it.resumes) }
    assertTrue("the timeouts are cancelled", scheduler.delayed.isEmpty())

    val later = start { provider.requestPurchase("\$rc_annual", onboarding) }
    assertEquals(SetgreetPurchaseErrorCode.NOT_CONFIGURED, later.value().error?.code)
    assertEquals("nothing more reaches JS", 6, sender.sent.size)
  }

  @Test
  fun `nothing listening fails every call at once without reaching JS`() {
    sender.reachable = false

    val load = start { provider.loadProducts(onboarding) }
    val purchase = start { provider.requestPurchase("\$rc_annual", onboarding) }
    val restore = start { provider.restorePurchases() }
    val access = start { provider.accessState() }
    val identify = start { provider.identify("user-1") }
    provider.trackPaywallImpression(
      SetgreetPaywallImpressionContext("flow-1", "screen-1", onboarding, listOf("\$rc_annual"))
    )
    provider.setAttributes(mapOf("setgreet_flow" to "flow-1"))

    assertTrue(sender.sent.isEmpty())
    assertEquals(SetgreetPurchaseErrorCode.NOT_CONFIGURED, (load.failure() as SetgreetPurchaseError).code)
    assertEquals(SetgreetPurchaseErrorCode.NOT_CONFIGURED, purchase.value().error?.code)
    assertEquals(SetgreetRestoreStatus.FAILED, restore.value().status)
    assertNull(access.value())
    assertEquals(Unit, identify.value())
    assertTrue(scheduler.delayed.isEmpty())
  }

  @Test
  fun `a request that cannot be emitted fails at once`() {
    sender.accepts = false

    val load = start { provider.loadProducts(onboarding) }
    val purchase = start { provider.requestPurchase("\$rc_annual", onboarding) }

    assertEquals(SetgreetPurchaseErrorCode.NOT_CONFIGURED, (load.failure() as SetgreetPurchaseError).code)
    assertEquals(SetgreetPurchaseErrorCode.NOT_CONFIGURED, purchase.value().error?.code)
    assertTrue("the load's timeout is cancelled", scheduler.delayed.isEmpty())
  }

  @Test
  fun `a bridge without a sender fails at once`() {
    val detached = RNSetgreetPurchaseProvider("revenuecat", RNSetgreetPurchaseBridge(scheduler))

    val purchase = start { detached.requestPurchase("\$rc_annual", onboarding) }

    assertEquals(SetgreetPurchaseErrorCode.NOT_CONFIGURED, purchase.value().error?.code)
  }

  @Test
  fun `a later registration's sender receives the requests`() {
    val next = FakeSender()
    bridge.attach(next)

    start { provider.accessState() }

    assertTrue(sender.sent.isEmpty())
    assertEquals(listOf("accessState"), next.sent.map { it["method"] })
  }

  @Test
  fun `fire-and-forget calls carry no request id and wait for nothing`() {
    provider.trackPaywallImpression(
      SetgreetPaywallImpressionContext("flow-1", "screen-1", onboarding, listOf("\$rc_annual"))
    )
    provider.setAttributes(mapOf("setgreet_flow" to "flow-1", "setgreet_screen" to "screen-1"))

    assertEquals(
      listOf(
        mapOf(
          "requestId" to null,
          "method" to "trackPaywallImpression",
          "args" to mapOf(
            "context" to mapOf(
              "flowId" to "flow-1",
              "screenId" to "screen-1",
              "source" to mapOf("sourceType" to "offering", "sourceId" to "onboarding"),
              "productRefs" to listOf("\$rc_annual")
            )
          )
        ),
        mapOf(
          "requestId" to null,
          "method" to "setAttributes",
          "args" to mapOf("attributes" to mapOf("setgreet_flow" to "flow-1", "setgreet_screen" to "screen-1"))
        )
      ),
      sender.sent
    )
    assertTrue(scheduler.delayed.isEmpty())
  }

  @Test
  fun `an error answer fails the call with the decoded error`() {
    val purchase = start { provider.requestPurchase("\$rc_annual", onboarding) }
    bridge.resolve(sender.requestId(), null, mapOf("code" to "network_error", "providerCode" to 10.0, "message" to "offline"))

    assertEquals(SetgreetPurchaseStatus.FAILED, purchase.value().status)
    assertEquals(
      SetgreetPurchaseError(SetgreetPurchaseErrorCode.NETWORK_ERROR, "10", "offline"),
      purchase.value().error
    )

    val load = start { provider.loadProducts(onboarding) }
    bridge.resolve(sender.requestId(), null, mapOf("code" to "provider_not_initialized"))
    assertEquals(
      SetgreetPurchaseErrorCode.PROVIDER_NOT_INITIALIZED,
      (load.failure() as SetgreetPurchaseError).code
    )

    val restore = start { provider.restorePurchases() }
    bridge.resolve(sender.requestId(), null, mapOf("code" to "bogus"))
    assertEquals(SetgreetRestoreStatus.FAILED, restore.value().status)
    assertEquals(SetgreetPurchaseErrorCode.UNKNOWN, restore.value().error?.code)

    val access = start { provider.accessState() }
    bridge.resolve(sender.requestId(), null, mapOf("code" to "unknown"))
    assertNull(access.value())
  }

  @Test
  fun `cancelled and pending answers keep their status and error`() {
    // JS turns a provider that rejects with these codes into these results.
    val cancelled = start { provider.requestPurchase("\$rc_annual", onboarding) }
    bridge.resolve(
      sender.requestId(),
      mapOf(
        "status" to "cancelled",
        "productRef" to "\$rc_annual",
        "accessRefs" to emptyList<String>(),
        "error" to mapOf("code" to "purchase_cancelled", "providerCode" to "1", "message" to null)
      ),
      null
    )
    val pending = start { provider.requestPurchase("\$rc_monthly", onboarding) }
    bridge.resolve(
      sender.requestId(),
      mapOf("status" to "pending", "error" to mapOf("code" to "purchase_pending")),
      null
    )

    assertEquals(SetgreetPurchaseStatus.CANCELLED, cancelled.value().status)
    assertEquals(SetgreetPurchaseErrorCode.PURCHASE_CANCELLED, cancelled.value().error?.code)
    assertEquals(SetgreetPurchaseStatus.PENDING, pending.value().status)
    assertEquals("\$rc_monthly", pending.value().productRef)
    assertEquals(SetgreetPurchaseErrorCode.PURCHASE_PENDING, pending.value().error?.code)
  }

  @Test
  fun `restore and access state answers are decoded`() {
    val restore = start { provider.restorePurchases() }
    bridge.resolve(sender.requestId(), mapOf("status" to "restored", "accessRefs" to listOf("pro")), null)
    val access = start { provider.accessState() }
    bridge.resolve(sender.requestId(), mapOf("accessState" to mapOf("active" to true, "accessRefs" to listOf("pro"))), null)
    val cannotSay = start { provider.accessState() }
    bridge.resolve(sender.requestId(), mapOf("accessState" to null), null)

    assertEquals(SetgreetRestoreStatus.RESTORED, restore.value().status)
    assertEquals(listOf("pro"), restore.value().accessRefs)
    assertEquals(listOf("pro"), access.value()?.accessRefs)
    assertTrue(access.value()?.active == true)
    assertNull(cannotSay.value())
  }
}
