# Autosuite GUI

Autosuite GUI is the official desktop application for **Autosuite**, providing a graphical interface for running provisioning, configuration restore, and verification workflows.

The GUI is designed to consume Autosuite strictly through its public CLI interface, ensuring a clear separation between the engine and the user interface.

## Status

This project is under active development and is not yet intended for general use.

## Relationship to Autosuite

Autosuite GUI relies on the Autosuite CLI being installed and available on the system PATH.  
All operations are executed by invoking the CLI and consuming its structured output.

Autosuite (the core engine) is open source and licensed under the Apache License 2.0.  
Autosuite GUI is a separate project with its own licensing and distribution model.

## License

Copyright © Substrate Systems OÜ.  
All rights reserved.

This repository does not grant permission to use, modify, or redistribute the code unless explicitly stated otherwise.

## Notes

This repository exists to develop the official Autosuite desktop experience.  
Details about distribution, pricing, and supported platforms will be documented closer to release.
