﻿using System.Linq;
using System.Reflection;
using Autofac;
using Hadouken.Plugins;
using Nancy;
using Nancy.Bootstrapper;
using Nancy.Bootstrappers.Autofac;
using Nancy.Conventions;
using Nancy.Responses;
using Nancy.Security;
using Nancy.ViewEngines;

namespace Hadouken.Http.Management
{
    public class CustomNancyBootstrapper : AutofacNancyBootstrapper
    {
        private static readonly Nancy.ViewEngines.Razor.DefaultRazorConfiguration conf__;
        private static readonly System.Web.Razor.RazorCodeLanguage lang__;

        private readonly ILifetimeScope _container;
        private readonly Assembly _assembly;

        public CustomNancyBootstrapper(ILifetimeScope container)
        {
            _container = container;
            _assembly = GetType().Assembly;
        }

        protected override ILifetimeScope GetApplicationContainer()
        {
            return _container;
        }

        protected override void ConfigureApplicationContainer(ILifetimeScope container)
        {
            base.ConfigureApplicationContainer(container);
            ResourceViewLocationProvider.RootNamespaces.Add(_assembly, "Hadouken.Http.Management.UI");
        }

        protected override void ApplicationStartup(ILifetimeScope container, IPipelines pipelines)
        {
            base.ApplicationStartup(container, pipelines);

            pipelines.BeforeRequest.AddItemToStartOfPipeline(context =>
            {
                if (context.Request.UserHostAddress == "127.0.0.1"
                    || context.Request.UserHostAddress == "::1"
                    || context.Request.Path == "/login")
                {
                    return null;
                }

                var auth = context.GetAuthenticationManager();
                return (auth == null || auth.User == null || !auth.User.Identity.IsAuthenticated)
                    ? HttpStatusCode.Unauthorized
                    : (Response)null;
            });

            pipelines.AfterRequest.AddItemToEndOfPipeline(context =>
            {
                if (context.Response.StatusCode == HttpStatusCode.Unauthorized)
                {
                    context.Response = new RedirectResponse("/login");
                }
                else
                {
                    var engine = _container.Resolve<IPluginEngine>();
                    var plugins =
                        engine.GetAll()
                            .Where(
                                p =>
                                    p.Manifest.UserInterface != null && p.Manifest.UserInterface.BackgroundScripts.Any());


                    var scripts = (from plugin in plugins
                        from bgs in plugin.Manifest.UserInterface.BackgroundScripts
                        select string.Concat(plugin.Manifest.Name, "/", bgs)).ToArray();

                    context.ViewBag.BackgroundScripts = scripts;
                }
            });
        }

        protected override void ConfigureConventions(NancyConventions nancyConventions)
        {
            base.ConfigureConventions(nancyConventions);

            var content = EmbeddedStaticContentConventionBuilder.AddDirectory("/Content", _assembly,
                namespaceRoot: "Hadouken.Http.Management.UI");
            var scripts = EmbeddedStaticContentConventionBuilder.AddDirectory("/Scripts", _assembly,
                namespaceRoot: "Hadouken.Http.Management.UI");

            nancyConventions.StaticContentsConventions.Add(content);
            nancyConventions.StaticContentsConventions.Add(scripts);
        }

        protected override NancyInternalConfiguration InternalConfiguration
        {
            get { return NancyInternalConfiguration.WithOverrides(OnConfigurationBuilder); }
        }

        private void OnConfigurationBuilder(NancyInternalConfiguration obj)
        {
            obj.ViewLocationProvider = typeof (ResourceViewLocationProvider);
        }
    }
}
