﻿using System;
using System.Collections.Generic;

namespace Hadouken.Plugins.Isolation
{
    public interface IIsolatedEnvironment
    {
        event EventHandler UnhandledError;

        int Id { get; }

        string Output { get; }

        string ErrorOutput { get; }

        void Load(IDictionary<string, object> configuration);

        void Unload();

        long GetMemoryUsage();
    }
}
