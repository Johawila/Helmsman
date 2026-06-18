using System.Runtime.CompilerServices;
using Helmsman.Api.Models;
using k8s;
using k8s.Autorest;
using k8s.Models;

namespace Helmsman.Api.Kube;

/// <summary>
/// Read-only queries against a cluster. Builds a client for the chosen context per call and
/// maps Kubernetes objects to framework-free <see cref="Models"/> DTOs before returning, so
/// the rest of the app never sees raw k8s types.
/// </summary>
public class ClusterReader
{
    private readonly KubeClientFactory _factory;

    public ClusterReader(KubeClientFactory factory)
    {
        _factory = factory;
    }

    public async Task<IReadOnlyList<string>> ListNamespacesAsync(
        string context,
        CancellationToken ct
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(context);

        using IKubernetes client = _factory.CreateClient(context);
        V1NamespaceList namespaces = await client.CoreV1.ListNamespaceAsync(cancellationToken: ct);
        return namespaces
            .Items.Select(ns => ns.Metadata.Name)
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToList();
    }

    public async Task<IReadOnlyList<PodInfo>> ListPodsAsync(
        string context,
        string @namespace,
        CancellationToken ct
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(context);
        ArgumentException.ThrowIfNullOrWhiteSpace(@namespace);

        using IKubernetes client = _factory.CreateClient(context);
        V1PodList pods = await client.CoreV1.ListNamespacedPodAsync(
            @namespace,
            cancellationToken: ct
        );
        return pods
            .Items.Select(ToPodInfo)
            .OrderBy(pod => pod.Name, StringComparer.Ordinal)
            .ToList();
    }

    /// <summary>
    /// Lists pods scheduled on a given node, across all namespaces (via a fieldSelector on
    /// spec.nodeName). Used to drill into a node and reach pod logs from there.
    /// </summary>
    public async Task<IReadOnlyList<PodInfo>> ListPodsOnNodeAsync(
        string context,
        string node,
        CancellationToken ct
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(context);
        ArgumentException.ThrowIfNullOrWhiteSpace(node);

        using IKubernetes client = _factory.CreateClient(context);
        V1PodList pods = await client.CoreV1.ListPodForAllNamespacesAsync(
            fieldSelector: $"spec.nodeName={node}",
            cancellationToken: ct
        );
        return pods
            .Items.Select(ToPodInfo)
            .OrderBy(p => p.Namespace, StringComparer.Ordinal)
            .ThenBy(p => p.Name, StringComparer.Ordinal)
            .ToList();
    }

    /// <summary>
    /// Current CPU/memory usage per pod from metrics-server (metrics.k8s.io). Polled, not watched —
    /// the metrics API has no watch. Pods without samples (e.g. just-started or completed) are omitted.
    /// </summary>
    public async Task<IReadOnlyList<PodMetricsInfo>> ListPodMetricsAsync(
        string context,
        string @namespace,
        CancellationToken ct
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(context);
        ArgumentException.ThrowIfNullOrWhiteSpace(@namespace);
        ct.ThrowIfCancellationRequested();

        using IKubernetes client = _factory.CreateClient(context);
        PodMetricsList metrics = await client.GetKubernetesPodsMetricsByNamespaceAsync(@namespace);
        return metrics
            .Items.Select(ToMetricsInfo)
            .OrderBy(m => m.Name, StringComparer.Ordinal)
            .ToList();
    }

    private static PodMetricsInfo ToMetricsInfo(PodMetrics metrics)
    {
        decimal cores = 0m;
        decimal bytes = 0m;
        foreach (ContainerMetrics container in metrics.Containers ?? [])
        {
            if (container.Usage.TryGetValue("cpu", out ResourceQuantity? cpu))
            {
                cores += cpu.ToDecimal();
            }
            if (container.Usage.TryGetValue("memory", out ResourceQuantity? memory))
            {
                bytes += memory.ToDecimal();
            }
        }

        return new PodMetricsInfo
        {
            Name = metrics.Metadata.Name,
            CpuMillicores = (int)Math.Round(cores * 1000m),
            MemoryMi = (int)Math.Round(bytes / (1024m * 1024m)),
        };
    }

    public IAsyncEnumerable<ResourceEvent<PodInfo>> WatchPodsAsync(
        string context,
        string @namespace,
        CancellationToken ct
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(@namespace);
        return WatchWithClientAsync<V1Pod, V1PodList, PodInfo>(
            context,
            (c, t) => c.CoreV1.ListNamespacedPodAsync(@namespace, cancellationToken: t),
            (c, rv) =>
                c.CoreV1.ListNamespacedPodWithHttpMessagesAsync(
                    @namespace,
                    watch: true,
                    resourceVersion: rv,
                    cancellationToken: ct
                ),
            ToPodInfo,
            p => p.Metadata.Name,
            ct
        );
    }

    public IAsyncEnumerable<ResourceEvent<WorkloadInfo>> WatchDeploymentsAsync(
        string context,
        string @namespace,
        CancellationToken ct
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(@namespace);
        return WatchWithClientAsync<V1Deployment, V1DeploymentList, WorkloadInfo>(
            context,
            (c, t) => c.AppsV1.ListNamespacedDeploymentAsync(@namespace, cancellationToken: t),
            (c, rv) =>
                c.AppsV1.ListNamespacedDeploymentWithHttpMessagesAsync(
                    @namespace,
                    watch: true,
                    resourceVersion: rv,
                    cancellationToken: ct
                ),
            ToWorkload,
            d => d.Metadata.Name,
            ct
        );
    }

    public IAsyncEnumerable<ResourceEvent<WorkloadInfo>> WatchStatefulSetsAsync(
        string context,
        string @namespace,
        CancellationToken ct
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(@namespace);
        return WatchWithClientAsync<V1StatefulSet, V1StatefulSetList, WorkloadInfo>(
            context,
            (c, t) => c.AppsV1.ListNamespacedStatefulSetAsync(@namespace, cancellationToken: t),
            (c, rv) =>
                c.AppsV1.ListNamespacedStatefulSetWithHttpMessagesAsync(
                    @namespace,
                    watch: true,
                    resourceVersion: rv,
                    cancellationToken: ct
                ),
            ToWorkload,
            s => s.Metadata.Name,
            ct
        );
    }

    public IAsyncEnumerable<ResourceEvent<WorkloadInfo>> WatchDaemonSetsAsync(
        string context,
        string @namespace,
        CancellationToken ct
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(@namespace);
        return WatchWithClientAsync<V1DaemonSet, V1DaemonSetList, WorkloadInfo>(
            context,
            (c, t) => c.AppsV1.ListNamespacedDaemonSetAsync(@namespace, cancellationToken: t),
            (c, rv) =>
                c.AppsV1.ListNamespacedDaemonSetWithHttpMessagesAsync(
                    @namespace,
                    watch: true,
                    resourceVersion: rv,
                    cancellationToken: ct
                ),
            ToWorkload,
            d => d.Metadata.Name,
            ct
        );
    }

    public IAsyncEnumerable<ResourceEvent<JobInfo>> WatchJobsAsync(
        string context,
        string @namespace,
        CancellationToken ct
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(@namespace);
        return WatchWithClientAsync<V1Job, V1JobList, JobInfo>(
            context,
            (c, t) => c.BatchV1.ListNamespacedJobAsync(@namespace, cancellationToken: t),
            (c, rv) =>
                c.BatchV1.ListNamespacedJobWithHttpMessagesAsync(
                    @namespace,
                    watch: true,
                    resourceVersion: rv,
                    cancellationToken: ct
                ),
            ToJob,
            j => j.Metadata.Name,
            ct
        );
    }

    public IAsyncEnumerable<ResourceEvent<CronJobInfo>> WatchCronJobsAsync(
        string context,
        string @namespace,
        CancellationToken ct
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(@namespace);
        return WatchWithClientAsync<V1CronJob, V1CronJobList, CronJobInfo>(
            context,
            (c, t) => c.BatchV1.ListNamespacedCronJobAsync(@namespace, cancellationToken: t),
            (c, rv) =>
                c.BatchV1.ListNamespacedCronJobWithHttpMessagesAsync(
                    @namespace,
                    watch: true,
                    resourceVersion: rv,
                    cancellationToken: ct
                ),
            ToCronJob,
            cj => cj.Metadata.Name,
            ct
        );
    }

    /// <summary>
    /// Live stream of Warning events in the namespace (FailedScheduling, BackOff, OOMKilled, image
    /// pull errors, …). Normal events are filtered out — they're noise for a health view. Event
    /// messages are cluster content and are never logged server-side.
    /// </summary>
    public IAsyncEnumerable<ResourceEvent<EventInfo>> WatchEventsAsync(
        string context,
        string @namespace,
        CancellationToken ct
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(@namespace);
        return WatchWithClientAsync<Corev1Event, Corev1EventList, EventInfo>(
            context,
            (c, t) => c.CoreV1.ListNamespacedEventAsync(@namespace, cancellationToken: t),
            (c, rv) =>
                c.CoreV1.ListNamespacedEventWithHttpMessagesAsync(
                    @namespace,
                    watch: true,
                    resourceVersion: rv,
                    cancellationToken: ct
                ),
            ToEventInfo,
            e => e.Metadata.Name,
            ct,
            include: e => string.Equals(e.Type, "Warning", StringComparison.Ordinal)
        );
    }

    /// <summary>
    /// Live stream of cluster nodes. Cluster-scoped (not namespaced), but shares the same
    /// list+watch loop via the namespace-agnostic list/watch funcs.
    /// </summary>
    public IAsyncEnumerable<ResourceEvent<NodeInfo>> WatchNodesAsync(
        string context,
        CancellationToken ct
    )
    {
        return WatchWithClientAsync<V1Node, V1NodeList, NodeInfo>(
            context,
            (c, t) => c.CoreV1.ListNodeAsync(cancellationToken: t),
            (c, rv) =>
                c.CoreV1.ListNodeWithHttpMessagesAsync(
                    watch: true,
                    resourceVersion: rv,
                    cancellationToken: ct
                ),
            ToNodeInfo,
            n => n.Metadata.Name,
            ct
        );
    }

    /// <summary>
    /// Resolves a representative pod for a workload so its logs can be streamed (kubectl-style:
    /// pick a pod matching the workload's selector). Returns null for kinds without a pod selector
    /// (e.g. CronJobs) or when no pods exist.
    /// </summary>
    public async Task<string?> ResolvePodAsync(
        string context,
        string @namespace,
        string kind,
        string name,
        CancellationToken ct
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(context);
        ArgumentException.ThrowIfNullOrWhiteSpace(@namespace);
        ArgumentException.ThrowIfNullOrWhiteSpace(name);

        using IKubernetes client = _factory.CreateClient(context);

        V1LabelSelector? selector = kind switch
        {
            "Deployments" => (
                await client.AppsV1.ReadNamespacedDeploymentAsync(
                    name,
                    @namespace,
                    cancellationToken: ct
                )
            )
                .Spec
                ?.Selector,
            "StatefulSets" => (
                await client.AppsV1.ReadNamespacedStatefulSetAsync(
                    name,
                    @namespace,
                    cancellationToken: ct
                )
            )
                .Spec
                ?.Selector,
            "DaemonSets" => (
                await client.AppsV1.ReadNamespacedDaemonSetAsync(
                    name,
                    @namespace,
                    cancellationToken: ct
                )
            )
                .Spec
                ?.Selector,
            "Jobs" => (
                await client.BatchV1.ReadNamespacedJobAsync(name, @namespace, cancellationToken: ct)
            )
                .Spec
                ?.Selector,
            _ => null,
        };

        string? labelSelector = ToLabelSelector(selector);
        if (labelSelector is null)
        {
            return null;
        }

        V1PodList pods = await client.CoreV1.ListNamespacedPodAsync(
            @namespace,
            labelSelector: labelSelector,
            cancellationToken: ct
        );
        V1Pod? pod =
            pods.Items.FirstOrDefault(p => p.Status?.Phase == "Running")
            ?? pods.Items.FirstOrDefault();
        return pod?.Metadata.Name;
    }

    /// <summary>
    /// Read-only "describe" for a single namespaced resource: labels, status conditions, container
    /// images, and the events recorded against it. One object read plus an events query.
    /// </summary>
    public async Task<ResourceDetail> DescribeAsync(
        string context,
        string @namespace,
        string kind,
        string name,
        CancellationToken ct
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(context);
        ArgumentException.ThrowIfNullOrWhiteSpace(@namespace);
        ArgumentException.ThrowIfNullOrWhiteSpace(kind);
        ArgumentException.ThrowIfNullOrWhiteSpace(name);

        using IKubernetes client = _factory.CreateClient(context);

        var detail = new ResourceDetail
        {
            Kind = kind,
            Name = name,
            Namespace = @namespace,
        };

        switch (kind)
        {
            case "Pods":
            {
                V1Pod o = await client.CoreV1.ReadNamespacedPodAsync(
                    name,
                    @namespace,
                    cancellationToken: ct
                );
                Fill(detail, o.Metadata, ContainerImages(o.Spec?.Containers));
                detail.Conditions =
                    o.Status?.Conditions?.Select(c =>
                            Condition(c.Type, c.Status, c.Reason, c.Message, c.LastTransitionTime)
                        )
                        .ToList()
                    ?? [];
                break;
            }
            case "Deployments":
            {
                V1Deployment o = await client.AppsV1.ReadNamespacedDeploymentAsync(
                    name,
                    @namespace,
                    cancellationToken: ct
                );
                Fill(detail, o.Metadata, TemplateImages(o.Spec?.Template));
                detail.Conditions =
                    o.Status?.Conditions?.Select(c =>
                            Condition(c.Type, c.Status, c.Reason, c.Message, c.LastTransitionTime)
                        )
                        .ToList()
                    ?? [];
                break;
            }
            case "StatefulSets":
            {
                V1StatefulSet o = await client.AppsV1.ReadNamespacedStatefulSetAsync(
                    name,
                    @namespace,
                    cancellationToken: ct
                );
                Fill(detail, o.Metadata, TemplateImages(o.Spec?.Template));
                detail.Conditions =
                    o.Status?.Conditions?.Select(c =>
                            Condition(c.Type, c.Status, c.Reason, c.Message, c.LastTransitionTime)
                        )
                        .ToList()
                    ?? [];
                break;
            }
            case "DaemonSets":
            {
                V1DaemonSet o = await client.AppsV1.ReadNamespacedDaemonSetAsync(
                    name,
                    @namespace,
                    cancellationToken: ct
                );
                Fill(detail, o.Metadata, TemplateImages(o.Spec?.Template));
                detail.Conditions =
                    o.Status?.Conditions?.Select(c =>
                            Condition(c.Type, c.Status, c.Reason, c.Message, c.LastTransitionTime)
                        )
                        .ToList()
                    ?? [];
                break;
            }
            case "Jobs":
            {
                V1Job o = await client.BatchV1.ReadNamespacedJobAsync(
                    name,
                    @namespace,
                    cancellationToken: ct
                );
                Fill(detail, o.Metadata, TemplateImages(o.Spec?.Template));
                detail.Conditions =
                    o.Status?.Conditions?.Select(c =>
                            Condition(c.Type, c.Status, c.Reason, c.Message, c.LastTransitionTime)
                        )
                        .ToList()
                    ?? [];
                break;
            }
            case "CronJobs":
            {
                V1CronJob o = await client.BatchV1.ReadNamespacedCronJobAsync(
                    name,
                    @namespace,
                    cancellationToken: ct
                );
                Fill(detail, o.Metadata, TemplateImages(o.Spec?.JobTemplate?.Spec?.Template));
                break;
            }
            default:
                throw new ArgumentException($"Describe is not supported for kind '{kind}'.");
        }

        Corev1EventList events = await client.CoreV1.ListNamespacedEventAsync(
            @namespace,
            fieldSelector: $"involvedObject.name={name}",
            cancellationToken: ct
        );
        detail.Events = events
            .Items.Select(ToEventInfo)
            .OrderByDescending(e => e.LastSeen)
            .Take(50)
            .ToList();

        return detail;
    }

    private static void Fill(ResourceDetail detail, V1ObjectMeta? meta, List<string> images)
    {
        detail.Labels = meta?.Labels is { } labels ? new Dictionary<string, string>(labels) : [];
        detail.Images = images;
        detail.CreatedAt = Timestamp(meta);
    }

    private static ConditionInfo Condition(
        string? type,
        string? status,
        string? reason,
        string? message,
        DateTime? lastTransition
    ) =>
        new()
        {
            Type = type ?? "",
            Status = status ?? "",
            Reason = reason ?? "",
            Message = message ?? "",
            LastTransition = lastTransition is { } t ? new DateTimeOffset(t, TimeSpan.Zero) : null,
        };

    private static List<string> ContainerImages(IList<V1Container>? containers) =>
        containers?.Select(c => c.Image).OfType<string>().ToList() ?? [];

    private static List<string> TemplateImages(V1PodTemplateSpec? template) =>
        ContainerImages(template?.Spec?.Containers);

    /// <summary>
    /// Creates a Kubernetes client for the context and streams a generic namespaced resource,
    /// owning the client for the life of the stream. The list/watch funcs receive the client.
    /// </summary>
    private async IAsyncEnumerable<ResourceEvent<TInfo>> WatchWithClientAsync<TItem, TList, TInfo>(
        string context,
        Func<IKubernetes, CancellationToken, Task<TList>> listAsync,
        Func<IKubernetes, string, Task<HttpOperationResponse<TList>>> watchFrom,
        Func<TItem, TInfo> map,
        Func<TItem, string> nameOf,
        [EnumeratorCancellation] CancellationToken ct,
        Func<TItem, bool>? include = null
    )
        where TItem : IKubernetesObject<V1ObjectMeta>
        where TList : IKubernetesObject<V1ListMeta>, IItems<TItem>
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(context);
        using IKubernetes client = _factory.CreateClient(context);
        await foreach (
            ResourceEvent<TInfo> e in WatchResourceAsync<TItem, TList, TInfo>(
                c => listAsync(client, c),
                rv => watchFrom(client, rv),
                map,
                nameOf,
                ct,
                include
            )
        )
        {
            yield return e;
        }
    }

    /// <summary>
    /// Generic list+watch loop shared by all resource kinds: emit a snapshot, watch from its
    /// resourceVersion, yield deltas, and resync (re-list → fresh snapshot) when the watch drops
    /// or the server expires it (410 Gone). Stops when <paramref name="ct"/> is cancelled.
    /// </summary>
    private static async IAsyncEnumerable<ResourceEvent<TInfo>> WatchResourceAsync<
        TItem,
        TList,
        TInfo
    >(
        Func<CancellationToken, Task<TList>> listAsync,
        Func<string, Task<HttpOperationResponse<TList>>> watchFrom,
        Func<TItem, TInfo> map,
        Func<TItem, string> nameOf,
        [EnumeratorCancellation] CancellationToken ct,
        Func<TItem, bool>? include = null
    )
        where TItem : IKubernetesObject<V1ObjectMeta>
        where TList : IKubernetesObject<V1ListMeta>, IItems<TItem>
    {
        bool Keep(TItem item) => include?.Invoke(item) ?? true;

        while (!ct.IsCancellationRequested)
        {
            TList list = await listAsync(ct);
            yield return ResourceEvent<TInfo>.Snapshot(
                list.Items.Where(Keep).OrderBy(nameOf, StringComparer.Ordinal).Select(map).ToList()
            );

            // WatchAsync is marked obsolete in v19, but it is the only IAsyncEnumerable-based
            // watch overload; the suggested replacement is callback-based and doesn't fit a stream.
#pragma warning disable CS0618
            IAsyncEnumerator<(WatchEventType Type, TItem Item)> events = watchFrom(
                    list.Metadata.ResourceVersion
                )
                .WatchAsync<TItem, TList>(cancellationToken: ct)
                .GetAsyncEnumerator(ct);
#pragma warning restore CS0618
            try
            {
                while (true)
                {
                    bool moved;
                    try
                    {
                        moved = await events.MoveNextAsync();
                    }
                    catch (OperationCanceledException)
                    {
                        yield break;
                    }
                    catch
                    {
                        break; // watch expired / dropped — resync via re-list
                    }

                    if (!moved)
                    {
                        break;
                    }

                    (WatchEventType type, TItem item) = events.Current;

                    // Skip upserts the filter rejects; still honour Deletes so a now-excluded item leaves.
                    if (type is WatchEventType.Added or WatchEventType.Modified && !Keep(item))
                    {
                        continue;
                    }

                    ResourceEvent<TInfo>? delta = type switch
                    {
                        WatchEventType.Added => ResourceEvent<TInfo>.Upsert("Added", map(item)),
                        WatchEventType.Modified => ResourceEvent<TInfo>.Upsert(
                            "Modified",
                            map(item)
                        ),
                        WatchEventType.Deleted => ResourceEvent<TInfo>.Deleted(nameOf(item)),
                        _ => null,
                    };
                    if (delta is not null)
                    {
                        yield return delta;
                    }
                }
            }
            finally
            {
                await events.DisposeAsync();
            }
        }
    }

    /// <summary>
    /// Streams a pod's logs line by line, following new output until the client disconnects
    /// (<paramref name="ct"/> cancelled) or the pod stops producing logs. Starts with the last
    /// 500 lines. If <paramref name="container"/> is null, the pod's first container is used.
    /// </summary>
    public async IAsyncEnumerable<string> StreamPodLogAsync(
        string context,
        string @namespace,
        string pod,
        string? container,
        [EnumeratorCancellation] CancellationToken ct
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(context);
        ArgumentException.ThrowIfNullOrWhiteSpace(@namespace);
        ArgumentException.ThrowIfNullOrWhiteSpace(pod);

        using IKubernetes client = _factory.CreateClient(context);

        string? containerName = container;
        if (string.IsNullOrWhiteSpace(containerName))
        {
            V1Pod target = await client.CoreV1.ReadNamespacedPodAsync(
                pod,
                @namespace,
                cancellationToken: ct
            );
            containerName = target.Spec?.Containers?.FirstOrDefault()?.Name;
        }

        using HttpOperationResponse<Stream> response =
            await client.CoreV1.ReadNamespacedPodLogWithHttpMessagesAsync(
                pod,
                @namespace,
                container: containerName,
                follow: true,
                tailLines: 500,
                cancellationToken: ct
            );
        using StreamReader reader = new(response.Body);

        while (!ct.IsCancellationRequested)
        {
            string? line;
            try
            {
                line = await reader.ReadLineAsync(ct);
            }
            catch (OperationCanceledException)
            {
                yield break;
            }

            if (line is null)
            {
                yield break;
            }

            yield return line;
        }
    }

    private static WorkloadInfo ToWorkload(V1Deployment d) =>
        new()
        {
            Name = d.Metadata.Name,
            Desired = d.Spec?.Replicas ?? 0,
            Ready = d.Status?.ReadyReplicas ?? 0,
            UpToDate = d.Status?.UpdatedReplicas ?? 0,
            Available = d.Status?.AvailableReplicas ?? 0,
            Image = FirstImage(d.Spec?.Template),
            CreatedAt = Timestamp(d.Metadata),
        };

    private static WorkloadInfo ToWorkload(V1StatefulSet s) =>
        new()
        {
            Name = s.Metadata.Name,
            Desired = s.Spec?.Replicas ?? 0,
            Ready = s.Status?.ReadyReplicas ?? 0,
            UpToDate = s.Status?.UpdatedReplicas ?? 0,
            Available = s.Status?.CurrentReplicas ?? 0,
            Image = FirstImage(s.Spec?.Template),
            CreatedAt = Timestamp(s.Metadata),
        };

    private static WorkloadInfo ToWorkload(V1DaemonSet d) =>
        new()
        {
            Name = d.Metadata.Name,
            Desired = d.Status?.DesiredNumberScheduled ?? 0,
            Ready = d.Status?.NumberReady ?? 0,
            UpToDate = d.Status?.UpdatedNumberScheduled ?? 0,
            Available = d.Status?.NumberAvailable ?? 0,
            Image = FirstImage(d.Spec?.Template),
            CreatedAt = Timestamp(d.Metadata),
        };

    private static JobInfo ToJob(V1Job j) =>
        new()
        {
            Name = j.Metadata.Name,
            Completions = j.Spec?.Completions ?? 0,
            Succeeded = j.Status?.Succeeded ?? 0,
            Failed = j.Status?.Failed ?? 0,
            Complete =
                j.Status?.Conditions?.Any(c =>
                    c.Type == "Complete"
                    && string.Equals(c.Status, "True", StringComparison.Ordinal)
                )
                ?? false,
            Image = FirstImage(j.Spec?.Template),
            CreatedAt = Timestamp(j.Metadata),
        };

    private static CronJobInfo ToCronJob(V1CronJob c) =>
        new()
        {
            Name = c.Metadata.Name,
            Schedule = c.Spec?.Schedule ?? "",
            Suspended = c.Spec?.Suspend ?? false,
            Active = c.Status?.Active?.Count ?? 0,
            LastSchedule = c.Status?.LastScheduleTime is { } ls
                ? new DateTimeOffset(ls, TimeSpan.Zero)
                : null,
            CreatedAt = Timestamp(c.Metadata),
        };

    private static EventInfo ToEventInfo(Corev1Event e) =>
        new()
        {
            Name = e.Metadata.Name,
            Type = e.Type ?? "",
            Reason = e.Reason ?? "",
            Message = e.Message ?? "",
            ObjectKind = e.InvolvedObject?.Kind ?? "",
            ObjectName = e.InvolvedObject?.Name ?? "",
            Count = e.Count ?? 0,
            LastSeen = LastSeen(e),
        };

    private static DateTimeOffset? LastSeen(Corev1Event e)
    {
        DateTime? when = e.LastTimestamp ?? e.EventTime ?? e.Metadata?.CreationTimestamp;
        return when is { } ts ? new DateTimeOffset(ts, TimeSpan.Zero) : null;
    }

    private static NodeInfo ToNodeInfo(V1Node node)
    {
        IList<V1NodeCondition> conditions = node.Status?.Conditions ?? [];
        bool Cond(string type) =>
            conditions.Any(c =>
                c.Type == type && string.Equals(c.Status, "True", StringComparison.Ordinal)
            );

        bool ready = Cond("Ready");
        string status = ready ? "Ready" : "NotReady";
        if (node.Spec?.Unschedulable == true)
        {
            status += ",SchedulingDisabled";
        }

        IDictionary<string, ResourceQuantity> allocatable =
            node.Status?.Allocatable ?? new Dictionary<string, ResourceQuantity>();

        return new NodeInfo
        {
            Name = node.Metadata.Name,
            Status = status,
            Roles = NodeRoles(node.Metadata?.Labels),
            KubeletVersion = node.Status?.NodeInfo?.KubeletVersion ?? "",
            CpuMillicores = allocatable.TryGetValue("cpu", out ResourceQuantity? cpu)
                ? (int)Math.Round(cpu.ToDecimal() * 1000m)
                : 0,
            MemoryMi = allocatable.TryGetValue("memory", out ResourceQuantity? mem)
                ? (int)Math.Round(mem.ToDecimal() / (1024m * 1024m))
                : 0,
            MemoryPressure = Cond("MemoryPressure"),
            DiskPressure = Cond("DiskPressure"),
            PidPressure = Cond("PIDPressure"),
            CreatedAt = Timestamp(node.Metadata),
        };
    }

    private static string NodeRoles(IDictionary<string, string>? labels)
    {
        if (labels is null)
        {
            return "<none>";
        }
        const string prefix = "node-role.kubernetes.io/";
        List<string> roles = labels
            .Keys.Where(k => k.StartsWith(prefix, StringComparison.Ordinal))
            .Select(k => k[prefix.Length..])
            .Where(r => r.Length > 0)
            .OrderBy(r => r, StringComparer.Ordinal)
            .ToList();
        return roles.Count > 0 ? string.Join(",", roles) : "<none>";
    }

    private static string? FirstImage(V1PodTemplateSpec? template) =>
        template?.Spec?.Containers?.FirstOrDefault()?.Image;

    private static DateTimeOffset? Timestamp(V1ObjectMeta? meta) =>
        meta?.CreationTimestamp is { } ts ? new DateTimeOffset(ts, TimeSpan.Zero) : null;

    private static string? ToLabelSelector(V1LabelSelector? selector)
    {
        if (selector?.MatchLabels is not { Count: > 0 } labels)
        {
            return null;
        }
        return string.Join(",", labels.Select(kv => $"{kv.Key}={kv.Value}"));
    }

    private static PodInfo ToPodInfo(V1Pod pod)
    {
        IList<V1ContainerStatus> statuses = pod.Status?.ContainerStatuses ?? [];
        int total = statuses.Count > 0 ? statuses.Count : pod.Spec?.Containers?.Count ?? 0;

        return new PodInfo
        {
            Name = pod.Metadata.Name,
            Namespace = pod.Metadata.NamespaceProperty ?? "",
            Phase = pod.Status?.Phase ?? "Unknown",
            Status = DerivePodStatus(pod),
            ReadyContainers = statuses.Count(s => s.Ready),
            TotalContainers = total,
            Restarts = statuses.Sum(s => s.RestartCount),
            Node = pod.Spec?.NodeName,
            CreatedAt = pod.Metadata?.CreationTimestamp is { } ts
                ? new DateTimeOffset(ts, TimeSpan.Zero)
                : null,
        };
    }

    /// <summary>
    /// kubectl-style pod status: a deleting pod is Terminating; otherwise the first meaningful
    /// container waiting/terminated reason wins (these explain trouble even while Phase is Running);
    /// then pod-level reasons (Evicted, …), unschedulable Pending, Succeeded→Completed, else Phase.
    /// </summary>
    private static string DerivePodStatus(V1Pod pod)
    {
        if (pod.Metadata?.DeletionTimestamp is not null)
        {
            return "Terminating";
        }

        V1PodStatus? status = pod.Status;

        string? containerReason =
            ContainerIssue(status?.InitContainerStatuses)
            ?? ContainerIssue(status?.ContainerStatuses);
        if (containerReason is not null)
        {
            return containerReason;
        }

        if (!string.IsNullOrEmpty(status?.Reason)) // Evicted, NodeLost, …
        {
            return status!.Reason;
        }

        if (status?.Phase == "Pending" && IsUnschedulable(status))
        {
            return "Unschedulable";
        }

        if (status?.Phase == "Succeeded")
        {
            return "Completed";
        }

        return status?.Phase ?? "Unknown";
    }

    private static string? ContainerIssue(IList<V1ContainerStatus>? statuses)
    {
        foreach (V1ContainerStatus cs in statuses ?? [])
        {
            string? waiting = cs.State?.Waiting?.Reason;
            if (
                !string.IsNullOrEmpty(waiting)
                && waiting is not "ContainerCreating" and not "PodInitializing"
            )
            {
                return waiting;
            }

            string? terminated = cs.State?.Terminated?.Reason;
            if (!string.IsNullOrEmpty(terminated) && terminated != "Completed")
            {
                return terminated;
            }
        }
        return null;
    }

    private static bool IsUnschedulable(V1PodStatus status) =>
        status.Conditions?.Any(c =>
            c.Type == "PodScheduled"
            && string.Equals(c.Status, "False", StringComparison.Ordinal)
            && c.Reason == "Unschedulable"
        )
        ?? false;
}
