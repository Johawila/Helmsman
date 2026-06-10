using Helmsman.Api.Models;
using k8s;
using k8s.KubeConfigModels;

namespace Helmsman.Api.Kube;

/// <summary>
/// Builds Kubernetes clients from the user's local kubeconfig.
/// Every client is bound to an explicitly named context — there is no
/// implicit fallback to the current-context, so the app can never silently
/// talk to whichever cluster kubectl happens to be pointed at.
/// </summary>
public class KubeClientFactory
{
    public IReadOnlyList<ContextInfo> ListContexts()
    {
        K8SConfiguration config = KubernetesClientConfiguration.LoadKubeConfig();
        return config.Contexts.Select(c => ToContextInfo(c, config.CurrentContext)).ToList();
    }

    public IKubernetes CreateClient(string contextName)
    {
        if (string.IsNullOrWhiteSpace(contextName))
        {
            throw new ArgumentException("A context name is required.", nameof(contextName));
        }

        if (!ContextExists(contextName))
        {
            throw new ArgumentException($"Unknown context '{contextName}'.", nameof(contextName));
        }

        KubernetesClientConfiguration clientConfig =
            KubernetesClientConfiguration.BuildConfigFromConfigFile(currentContext: contextName);
        return new Kubernetes(clientConfig);
    }

    private bool ContextExists(string contextName)
    {
        K8SConfiguration config = KubernetesClientConfiguration.LoadKubeConfig();
        return config.Contexts.Any(c => c.Name == contextName);
    }

    private static ContextInfo ToContextInfo(Context context, string? currentContext)
    {
        return new ContextInfo
        {
            Name = context.Name,
            Cluster = context.ContextDetails?.Cluster ?? "",
            Namespace = context.ContextDetails?.Namespace,
            IsCurrent = context.Name == currentContext,
        };
    }
}
