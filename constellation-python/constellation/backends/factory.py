from typing import Dict, Type, cast
from .base import FileSystemBackend
from .local import LocalBackend
from ..types import (
    BackendConfig,
    LocalBackendConfig,
    RemoteBackendConfig,
    DockerBackendConfig,
    FileSystemError
)
from ..constants import ERROR_CODES


class BackendFactory:
    """Factory for creating filesystem backend instances."""
    
    _backends: Dict[str, Type[FileSystemBackend]] = {
        "local": LocalBackend,
        # Future backends will be registered here
        # "remote": RemoteBackend,
        # "docker": DockerBackend,
    }
    
    @classmethod
    def create(cls, config: BackendConfig) -> FileSystemBackend:
        """Create a backend instance from configuration.
        
        Args:
            config: Backend configuration dictionary
            
        Returns:
            Configured backend instance
            
        Raises:
            FileSystemError: When backend type is unknown or configuration is invalid
        """
        backend_type = config.get("type")
        
        if not backend_type:
            raise FileSystemError(
                "Backend type must be specified in configuration",
                ERROR_CODES.INVALID_CONFIG
            )
        
        if backend_type not in cls._backends:
            available = ", ".join(cls._backends.keys())
            raise FileSystemError(
                f"Unknown backend type: {backend_type}. Available: {available}",
                ERROR_CODES.INVALID_BACKEND
            )
        
        backend_class: Type[FileSystemBackend] = cls._backends[backend_type]
        
        try:
            # Type checking: ensure config matches expected type
            if backend_type == "local":
                local_config = cast(LocalBackendConfig, config)
                return backend_class(local_config)
            elif backend_type == "remote":
                remote_config = cast(RemoteBackendConfig, config)  
                return backend_class(remote_config)
            elif backend_type == "docker":
                docker_config = cast(DockerBackendConfig, config)
                return backend_class(docker_config)
            else:
                # Fallback for any future backends
                return backend_class(config)
        
        except Exception as e:
            raise FileSystemError(
                f"Failed to create {backend_type} backend: {str(e)}",
                ERROR_CODES.INVALID_CONFIG
            ) from e
    
    @classmethod
    def register_backend(cls, name: str, backend_class: Type[FileSystemBackend]) -> None:
        """Register a new backend type.
        
        Args:
            name: Backend type name
            backend_class: Backend implementation class
        """
        cls._backends[name] = backend_class
    
    @classmethod
    def get_available_backends(cls) -> list[str]:
        """Get list of available backend types.
        
        Returns:
            List of available backend type names
        """
        return list(cls._backends.keys())