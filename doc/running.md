Running the System
==================

After building, the `out/final` directory contains the complete product. This
directory can be packaged up (`tar`ed etc.) for installation on a target
machine.

The product uses a `var` directory for temporary file storage. Where this
directory is located varies depending on the product configuration (via the
`config-server` module). By default, this directory will be `out/final/var`
under your source directory, which is suitable for local development but almost
certainly not for production deployment.

### Starting

Within the final product directory, the script `bin/run` starts the system.

### Stopping

When it is running, the following is the procedure to cleanly stop the system:

* Place a file called `shutdown` in the directory `var/control` (where `var` is
  the configured `var` directory).
* Send `SIGHUP` to the process running the product. **Note:** The process ID of
  a running server is stored in `var/control/pid.txt`.
* Wait for the process to exit. It will also place a file called `stopped` in
  the `control` directory.

If there are active clients of the server, system shutdown can take as long as
the longest possible timeout for long-poll type calls. (By default, such calls
have one-minute timeouts, but this can be configured.)

**Note:** If either the `shutdown` or `stopped` file is present in the
`control` directory when the system is starting, it will exit promptly instead
of actually booting up.
