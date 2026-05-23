# backend/simulator/server.py

import asyncio
import math
import random
import os
from asyncua import Server
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def run_simulator():
    # In Docker, bind to 0.0.0.0 so other containers can reach us.
    # In development, localhost is fine.
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
    device = await objects.add_object(namespace, "SimulatedDevice")

    temperature = await device.add_variable(namespace, "Temperature", 25.0)
    pressure    = await device.add_variable(namespace, "Pressure", 101.3)
    flow_rate   = await device.add_variable(namespace, "FlowRate", 50.0)

    # IsRunning is monitored but not written — no assignment needed
    await device.add_variable(namespace, "IsRunning", True)

    await temperature.set_writable()
    await pressure.set_writable()
    await flow_rate.set_writable()

    logger.info(f"OPC UA Simulator starting on {endpoint}")
    logger.info("Tags: Temperature, Pressure, FlowRate, IsRunning")

    async with server:
        tick = 0
        while True:
            tick += 1
            temp_value     = 25.0  + 10.0 * math.sin(tick * 0.1)  + random.uniform(-0.5, 0.5)
            pressure_value = 101.3 + 5.0  * math.cos(tick * 0.05) + random.uniform(-0.2, 0.2)
            flow_value     = 50.0  + 20.0 * math.sin(tick * 0.07) + random.uniform(-1.0, 1.0)

            await temperature.write_value(round(temp_value, 2))
            await pressure.write_value(round(pressure_value, 2))
            await flow_rate.write_value(round(flow_value, 2))

            await asyncio.sleep(1)


if __name__ == "__main__":
    asyncio.run(run_simulator())