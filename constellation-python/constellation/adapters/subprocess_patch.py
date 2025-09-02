"""Subprocess monkey-patching for SDK integrations."""

import sys
import subprocess
import asyncio
import shlex
from typing import Any, Optional, List, Union, Dict, Callable
from functools import wraps
from ..utils.logger import get_logger


class SubprocessInterceptor:
    """Intercepts subprocess calls and routes them through ConstellationFS."""
    
    def __init__(self, adapter: Any) -> None:
        """Initialize interceptor with an adapter instance.
        
        Args:
            adapter: SDK adapter instance that provides exec_sync method
        """
        self.adapter = adapter
        self.original_functions: Dict[str, Any] = {}
        self.enabled = False
        self.logger = get_logger('constellation.interceptor')
        self._in_constellation_call = False  # Flag to prevent recursion
        
        # Track which functions we've patched
        self._patched_functions = {
            'subprocess.run',
            'subprocess.Popen', 
            'subprocess.call',
            'subprocess.check_call',
            'subprocess.check_output',
            'asyncio.create_subprocess_shell',
            'asyncio.create_subprocess_exec'
        }
    
    def enable(self) -> None:
        """Enable subprocess interception."""
        if self.enabled:
            self.logger.warning("Subprocess interception already enabled")
            return
        
        self.logger.info("Enabling subprocess interception", 
                        patched_functions=list(self._patched_functions))
        
        # Store original functions
        self.original_functions = {
            'run': subprocess.run,
            'Popen': subprocess.Popen,
            'call': subprocess.call,
            'check_call': subprocess.check_call,
            'check_output': subprocess.check_output,
            'create_subprocess_shell': asyncio.create_subprocess_shell,
            'create_subprocess_exec': asyncio.create_subprocess_exec,
        }
        
        # Replace with interceptors
        subprocess.run = self._intercept_run  # type: ignore[assignment]
        subprocess.Popen = self._intercept_popen  # type: ignore[assignment,misc]
        subprocess.call = self._intercept_call
        subprocess.check_call = self._intercept_check_call
        subprocess.check_output = self._intercept_check_output  # type: ignore[assignment]
        
        # Patch asyncio subprocess functions
        asyncio.create_subprocess_shell = self._intercept_async_shell  # type: ignore[assignment]
        asyncio.create_subprocess_exec = self._intercept_async_exec  # type: ignore[assignment]
        
        self.enabled = True
    
    def disable(self) -> None:
        """Restore original subprocess functions."""
        if not self.enabled:
            self.logger.warning("Subprocess interception not enabled")
            return
        
        self.logger.info("Disabling subprocess interception")
        
        # Restore original functions
        subprocess.run = self.original_functions['run']
        subprocess.Popen = self.original_functions['Popen']  # type: ignore[misc]
        subprocess.call = self.original_functions['call']
        subprocess.check_call = self.original_functions['check_call']
        subprocess.check_output = self.original_functions['check_output']
        
        # Restore asyncio functions
        asyncio.create_subprocess_shell = self.original_functions['create_subprocess_shell']
        asyncio.create_subprocess_exec = self.original_functions['create_subprocess_exec']
        
        self.enabled = False
    
    def _extract_command(self, args: tuple[Any, ...], kwargs: Dict[str, Any]) -> str:
        """Extract shell command from subprocess arguments.
        
        Args:
            args: Positional arguments to subprocess function
            kwargs: Keyword arguments to subprocess function
            
        Returns:
            Extracted command as string
        """
        if args:
            # First argument is usually the command
            if isinstance(args[0], str):
                return args[0]
            elif isinstance(args[0], (list, tuple)):
                return shlex.join(args[0])
        
        # Check keyword arguments
        if 'args' in kwargs:
            cmd_args = kwargs['args']
            if isinstance(cmd_args, str):
                return cmd_args
            elif isinstance(cmd_args, (list, tuple)):
                return shlex.join(cmd_args)
        
        # Fallback
        return str(args[0]) if args else ""
    
    def _execute_safe(self, command: str) -> str:
        """Execute command safely, handling event loop conflicts.
        
        Args:
            command: Command to execute
            
        Returns:
            Command output
        """
        # Set flag to prevent recursion
        self._in_constellation_call = True
        try:
            # Check if we're in an event loop
            try:
                loop = asyncio.get_running_loop()
                # We're in an async context, need to run in thread
                import concurrent.futures
                
                def run_in_thread() -> str:
                    # Create new event loop for this thread
                    new_loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(new_loop)
                    try:
                        return new_loop.run_until_complete(self.adapter.bash(command))  # type: ignore[no-any-return]
                    finally:
                        new_loop.close()
                
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(run_in_thread)
                    return future.result()
                    
            except RuntimeError:
                # No event loop running, safe to use exec_sync
                return self.adapter.exec_sync(command)  # type: ignore[no-any-return]
        except Exception as e:
            self.logger.error("Command execution failed", command=command[:100], error=str(e))
            raise
        finally:
            # Reset flag after execution
            self._in_constellation_call = False
    
    def _create_completed_process(self, args: Any, output: str, error: Optional[str] = None, returncode: int = 0) -> subprocess.CompletedProcess[bytes]:
        """Create a subprocess.CompletedProcess from command results.
        
        Args:
            args: Original command args
            output: Command output
            error: Error output (if any)
            returncode: Return code
            
        Returns:
            CompletedProcess instance
        """
        return subprocess.CompletedProcess[bytes](
            args=args,
            returncode=returncode,
            stdout=output.encode() if output else b'',
            stderr=error.encode() if error else b''
        )
    
    def _intercept_run(self, *args: Any, **kwargs: Any) -> subprocess.CompletedProcess[bytes]:
        """Intercept subprocess.run calls."""
        # If we're already inside a ConstellationFS call, use original function
        if self._in_constellation_call:
            return self.original_functions['run'](*args, **kwargs)  # type: ignore[no-any-return]
        
        command = self._extract_command(args, kwargs)
        
        self.logger.debug("Intercepting subprocess.run", command=command[:100])
        
        try:
            output = self._execute_safe(command)
            return self._create_completed_process(
                args=args[0] if args else kwargs.get('args'),
                output=output
            )
        except Exception as e:
            return self._create_completed_process(
                args=args[0] if args else kwargs.get('args'),
                output="",
                error=str(e),
                returncode=1
            )
    
    def _intercept_popen(self, *args: Any, **kwargs: Any) -> "MockPopen":
        """Intercept subprocess.Popen calls."""
        # If we're already inside a ConstellationFS call, use original function
        if self._in_constellation_call:
            return self.original_functions['Popen'](*args, **kwargs)  # type: ignore[no-any-return]
        
        command = self._extract_command(args, kwargs)
        
        self.logger.debug("Intercepting subprocess.Popen", command=command[:100])
        
        # For Popen, we need to create a mock that behaves like a real Popen
        try:
            output = self._execute_safe(command)
            return MockPopen(output, "", 0)
        except Exception as e:
            self.logger.error("Intercepted Popen command failed", command=command[:100], error=str(e))
            return MockPopen("", str(e), 1)
    
    def _intercept_call(self, *args: Any, **kwargs: Any) -> int:
        """Intercept subprocess.call calls."""
        # If we're already inside a ConstellationFS call, use original function
        if self._in_constellation_call:
            return self.original_functions['call'](*args, **kwargs)  # type: ignore[no-any-return]
        
        command = self._extract_command(args, kwargs)
        
        self.logger.debug("Intercepting subprocess.call", command=command[:100])
        
        try:
            self._execute_safe(command)
            return 0
        except Exception as e:
            self.logger.error("Intercepted call failed", command=command[:100], error=str(e))
            return 1
    
    def _intercept_check_call(self, *args: Any, **kwargs: Any) -> int:
        """Intercept subprocess.check_call calls."""
        # If we're already inside a ConstellationFS call, use original function
        if self._in_constellation_call:
            return self.original_functions['check_call'](*args, **kwargs)  # type: ignore[no-any-return]
        
        command = self._extract_command(args, kwargs)
        
        self.logger.debug("Intercepting subprocess.check_call", command=command[:100])
        
        try:
            self._execute_safe(command)
            return 0
        except Exception as e:
            self.logger.error("Intercepted check_call failed", command=command[:100], error=str(e))
            # check_call raises on failure
            raise subprocess.CalledProcessError(1, command, str(e)) from e
    
    def _intercept_check_output(self, *args: Any, **kwargs: Any) -> bytes:
        """Intercept subprocess.check_output calls."""
        # If we're already inside a ConstellationFS call, use original function
        if self._in_constellation_call:
            return self.original_functions['check_output'](*args, **kwargs)  # type: ignore[no-any-return]
        
        command = self._extract_command(args, kwargs)
        
        self.logger.debug("Intercepting subprocess.check_output", command=command[:100])
        
        try:
            output = self._execute_safe(command)
            return output.encode()
        except Exception as e:
            self.logger.error("Intercepted check_output failed", command=command[:100], error=str(e))
            # check_output raises on failure
            raise subprocess.CalledProcessError(1, command, str(e)) from e
    
    async def _intercept_async_shell(self, cmd: str, **kwargs: Any) -> 'MockAsyncProcess':
        """Intercept asyncio.create_subprocess_shell calls."""
        # If we're already inside a ConstellationFS call, use original function
        if self._in_constellation_call:
            return await self.original_functions['create_subprocess_shell'](cmd, **kwargs)  # type: ignore[no-any-return]
        
        self.logger.debug("Intercepting asyncio.create_subprocess_shell", command=cmd[:100])
        
        try:
            output = await self.adapter.bash(cmd)
            return MockAsyncProcess(output, "", 0)
        except Exception as e:
            self.logger.error("Intercepted async shell failed", command=cmd[:100], error=str(e))
            return MockAsyncProcess("", str(e), 1)
    
    async def _intercept_async_exec(self, program: str, *args: Any, **kwargs: Any) -> 'MockAsyncProcess':
        """Intercept asyncio.create_subprocess_exec calls."""
        # If we're already inside a ConstellationFS call, use original function
        if self._in_constellation_call:
            return await self.original_functions['create_subprocess_exec'](program, *args, **kwargs)  # type: ignore[no-any-return]
        
        # Convert exec args to shell command
        cmd_parts = [program] + list(args)
        command = shlex.join(cmd_parts)
        
        self.logger.debug("Intercepting asyncio.create_subprocess_exec", command=command[:100])
        
        try:
            output = await self.adapter.bash(command)
            return MockAsyncProcess(output, "", 0)
        except Exception as e:
            self.logger.error("Intercepted async exec failed", command=command[:100], error=str(e))
            return MockAsyncProcess("", str(e), 1)


class MockPopen:
    """Mock subprocess.Popen that works with intercepted commands."""
    
    def __init__(self, stdout_data: str, stderr_data: str, returncode: int) -> None:
        """Initialize mock Popen.
        
        Args:
            stdout_data: Stdout content
            stderr_data: Stderr content  
            returncode: Process return code
        """
        self.stdout_data = stdout_data.encode()
        self.stderr_data = stderr_data.encode()
        self.returncode = returncode
        self.pid = 12345  # Mock PID
        
        # Create mock file objects for stdout/stderr
        from io import BytesIO
        self.stdout = BytesIO(self.stdout_data) if self.stdout_data else None
        self.stderr = BytesIO(self.stderr_data) if self.stderr_data else None
        self.stdin = None
    
    def communicate(self, input: Optional[bytes] = None) -> tuple[bytes, bytes]:
        """Mock communicate method."""
        return self.stdout_data, self.stderr_data
    
    def wait(self) -> int:
        """Mock wait method."""
        return self.returncode
    
    def poll(self) -> int:
        """Mock poll method.""" 
        return self.returncode
    
    def kill(self) -> None:
        """Mock kill method."""
        pass
    
    def terminate(self) -> None:
        """Mock terminate method."""
        pass


class MockAsyncProcess:
    """Mock asyncio subprocess process."""
    
    def __init__(self, stdout_data: str, stderr_data: str, returncode: int) -> None:
        """Initialize mock async process.
        
        Args:
            stdout_data: Stdout content
            stderr_data: Stderr content
            returncode: Process return code
        """
        self.stdout_data = stdout_data.encode()
        self.stderr_data = stderr_data.encode()
        self.returncode = returncode
        self.pid = 12345  # Mock PID
        
        # Create mock stream readers
        from asyncio import StreamReader
        self.stdout = MockStreamReader(self.stdout_data)
        self.stderr = MockStreamReader(self.stderr_data)
        self.stdin = None
    
    async def communicate(self, input: Optional[bytes] = None) -> tuple[bytes, bytes]:
        """Mock async communicate method."""
        return self.stdout_data, self.stderr_data
    
    async def wait(self) -> int:
        """Mock async wait method."""
        return self.returncode
    
    def kill(self) -> None:
        """Mock kill method."""
        pass
    
    def terminate(self) -> None:
        """Mock terminate method."""
        pass


class MockStreamReader:
    """Mock asyncio StreamReader for subprocess stdout/stderr."""
    
    def __init__(self, data: bytes) -> None:
        """Initialize mock stream reader.
        
        Args:
            data: Data to be read from stream
        """
        self.data = data
        self._position = 0
    
    async def read(self, n: int = -1) -> bytes:
        """Mock async read method."""
        if n == -1:
            result = self.data[self._position:]
            self._position = len(self.data)
        else:
            result = self.data[self._position:self._position + n]
            self._position += len(result)
        return result
    
    async def readline(self) -> bytes:
        """Mock async readline method."""
        start = self._position
        try:
            newline_pos = self.data.index(b'\n', start)
            result = self.data[start:newline_pos + 1]
            self._position = newline_pos + 1
        except ValueError:
            # No newline found
            result = self.data[start:]
            self._position = len(self.data)
        return result
    
    async def readlines(self) -> List[bytes]:
        """Mock async readlines method."""
        lines = []
        while True:
            line = await self.readline()
            if not line:
                break
            lines.append(line)
        return lines