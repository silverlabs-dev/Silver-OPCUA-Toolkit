# backend/simulator/server.py

import asyncio
import math
import random
import os
import logging

from asyncua import Server

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Signal generators ──────────────────────────────────────────────────────

def sine_wave(tick: int, base: float, amplitude: float, period: float, noise: float) -> float:
    """Smooth sine wave with gaussian noise."""
    return base + amplitude * math.sin(2 * math.pi * tick / period) + random.gauss(0, noise)


def step_change(tick: int, base: float, step_size: float, step_every: int) -> float:
    """Periodic step changes — simulates setpoint changes or load steps."""
    step = (tick // step_every) % 4
    offsets = [0, step_size, step_size * 0.6, step_size * 1.2]
    return base + offsets[step] + random.gauss(0, 0.3)


def noisy_analog(tick: int, base: float, drift_speed: float, noise: float) -> float:
    """Slow drift with high-frequency noise — simulates sensor degradation."""
    drift = drift_speed * math.sin(tick * 0.003)
    return base + drift + random.gauss(0, noise)


def spike(value: float, probability: float, spike_magnitude: float) -> float:
    """Random spike — simulates transient disturbances or bad readings."""
    if random.random() < probability:
        return value + random.choice([-1, 1]) * spike_magnitude * random.uniform(0.5, 1.0)
    return value


class SimulatorState:
    """Tracks simulator mode and transition logic."""

    MODES = ['normal', 'alarm', 'step', 'frozen', 'recovering']

    def __init__(self):
        self.mode = 'normal'
        self.mode_tick = 0          # Ticks spent in current mode
        self.frozen_value = None    # Value held during frozen state
        self.is_running = True

    def update(self, tick: int) -> None:
        self.mode_tick += 1

        # State machine — transition probabilities
        if self.mode == 'normal':
            if self.mode_tick > 60 and random.random() < 0.005:
                self.mode = 'alarm'
                self.mode_tick = 0
                logger.info("Simulator entering ALARM mode")
            elif self.mode_tick > 30 and random.random() < 0.008:
                self.mode = 'step'
                self.mode_tick = 0
                logger.info("Simulator entering STEP CHANGE mode")
            elif self.mode_tick > 20 and random.random() < 0.004:
                self.mode = 'frozen'
                self.mode_tick = 0
                logger.info("Simulator entering FROZEN (stale value) mode")

        elif self.mode == 'alarm':
            if self.mode_tick > 20:
                self.mode = 'recovering'
                self.mode_tick = 0
                self.is_running = False
                logger.info("Simulator entering RECOVERING mode")

        elif self.mode == 'step':
            if self.mode_tick > 15:
                self.mode = 'normal'
                self.mode_tick = 0
                logger.info("Simulator returning to NORMAL mode")

        elif self.mode == 'frozen':
            if self.mode_tick > 10:
                self.mode = 'normal'
                self.mode_tick = 0
                self.frozen_value = None
                logger.info("Simulator returning to NORMAL mode (unfrozen)")

        elif self.mode == 'recovering':
            if self.mode_tick > 15:
                self.mode = 'normal'
                self.mode_tick = 0
                self.is_running = True
                logger.info("Simulator RECOVERED — back to NORMAL mode")


# ── Main simulator ─────────────────────────────────────────────────────────

async def run_simulator():
    host = os.environ.get("SIMULATOR_HOST", "0.0.0.0")
    port = int(os.environ.get("SIMULATOR_PORT", "4840"))
    endpoint = f"opc.tcp://{host}:{port}"

    server = Server()
    await server.init()
    server.set_endpoint(endpoint)
    server.set_server_name("Industrial AI Toolkit - Simulator")

    uri = "http://industrial-ai-toolkit.local"
    namespace = await server.register_namespace(uri)

    objects = server.get_objects_node()
    device  = await objects.add_object(namespace, "SimulatedDevice")

    temperature = await device.add_variable(namespace, "Temperature", 25.0)
    pressure    = await device.add_variable(namespace, "Pressure", 101.3)
    flow_rate   = await device.add_variable(namespace, "FlowRate", 50.0)
    is_running  = await device.add_variable(namespace, "IsRunning", True)

    await temperature.set_writable()
    await pressure.set_writable()
    await flow_rate.set_writable()

    logger.info(f"OPC UA Simulator starting on {endpoint}")
    logger.info("Tags: Temperature, Pressure, FlowRate, IsRunning")
    logger.info("Modes: normal → alarm → recovering → step → frozen → normal")

    state = SimulatorState()

    async with server:
        tick = 0
        while True:
            tick += 1
            state.update(tick)

            # ── Compute tag values based on current mode ──

            if state.mode == 'normal':
                # Smooth sine wave with light noise
                temp  = sine_wave(tick, 25.0, 10.0, 120, 0.3)
                pres  = sine_wave(tick, 101.3, 5.0, 200, 0.15)
                flow  = sine_wave(tick, 50.0, 20.0, 90, 0.5)
                # Occasional small spikes
                temp  = spike(temp, 0.02, 3.0)
                flow  = spike(flow, 0.02, 5.0)

            elif state.mode == 'alarm':
                # Values go out of normal range — simulates process upset
                temp  = 25.0 + 18.0 + random.gauss(0, 1.5)   # High temperature alarm
                pres  = 101.3 - 12.0 + random.gauss(0, 0.8)  # Low pressure alarm
                flow  = 50.0 + 30.0 + random.gauss(0, 2.0)   # High flow alarm

            elif state.mode == 'step':
                # Step change — simulates setpoint change or load step
                temp  = step_change(tick, 25.0, 8.0, 5) + random.gauss(0, 0.3)
                pres  = step_change(tick, 101.3, 4.0, 5) + random.gauss(0, 0.2)
                flow  = step_change(tick, 50.0, 15.0, 5) + random.gauss(0, 0.5)

            elif state.mode == 'frozen':
                # Stale/frozen values — simulates sensor freeze or bad quality
                if state.frozen_value is None:
                    state.frozen_value = (
                        round(sine_wave(tick, 25.0, 10.0, 120, 0), 2),
                        round(sine_wave(tick, 101.3, 5.0, 200, 0), 2),
                        round(sine_wave(tick, 50.0, 20.0, 90, 0), 2),
                    )
                temp, pres, flow = state.frozen_value

            elif state.mode == 'recovering':
                # Slowly returning to normal — exponential decay toward setpoint
                temp  = noisy_analog(tick, 25.0, 5.0, 1.2)
                pres  = noisy_analog(tick, 101.3, 3.0, 0.6)
                flow  = noisy_analog(tick, 50.0, 8.0, 1.5)

            else:
                temp, pres, flow = 25.0, 101.3, 50.0

            # Write values to OPC UA server
            await temperature.write_value(round(float(temp), 2))
            await pressure.write_value(round(float(pres), 2))
            await flow_rate.write_value(round(float(flow), 2))
            await is_running.write_value(state.is_running)

            await asyncio.sleep(1)


if __name__ == "__main__":
    asyncio.run(run_simulator())